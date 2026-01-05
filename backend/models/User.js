/**
 * User Model
 * 
 * Defines the user schema for authentication and role-based access control.
 * Users can be either:
 * - PROCUREMENT_OFFICER: Can submit procurement events
 * - AUDITOR: Read-only access to dashboards and reports
 * 
 * Password is hashed using bcrypt before storage.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
    // Unique username for login
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [50, 'Username cannot exceed 50 characters']
    },

    // Email address (optional but unique if provided)
    email: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null values
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },

    // Hashed password
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false // Don't include in queries by default
    },

    // User role - determines access permissions
    role: {
        type: String,
        enum: {
            values: Object.values(ROLES),
            message: 'Role must be either PROCUREMENT_OFFICER or AUDITOR'
        },
        required: [true, 'Role is required'],
        default: ROLES.AUDITOR
    },

    // Full name for display purposes
    fullName: {
        type: String,
        trim: true,
        maxlength: [100, 'Full name cannot exceed 100 characters']
    },

    // Department association (for procurement officers)
    departmentId: {
        type: String,
        trim: true
    },

    // Account status
    isActive: {
        type: Boolean,
        default: true
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true // Cannot be changed after creation
    },

    lastLogin: {
        type: Date
    }
}, {
    timestamps: false // We manage timestamps manually for audit purposes
});

// ============================================
// INDEXES
// ============================================
userSchema.index({ role: 1 });
userSchema.index({ departmentId: 1 });
userSchema.index({ isActive: 1 });

// ============================================
// PRE-SAVE MIDDLEWARE
// Hash password before saving
// ============================================
userSchema.pre('save', async function (next) {
    // Only hash if password is new or modified
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Generate salt with cost factor 12 (balance of security and performance)
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Compare provided password with stored hash
 * @param {string} candidatePassword - Password to verify
 * @returns {Promise<boolean>} - True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    // Need to explicitly select password since it's excluded by default
    const user = await this.constructor.findById(this._id).select('+password');
    if (!user || !user.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, user.password);
};

/**
 * Check if user can submit events (procurement officer only)
 * @returns {boolean}
 */
userSchema.methods.canSubmitEvents = function () {
    return this.role === ROLES.PROCUREMENT_OFFICER && this.isActive;
};

/**
 * Check if user can view reports (all authenticated users)
 * @returns {boolean}
 */
userSchema.methods.canViewReports = function () {
    return this.isActive;
};

/**
 * Get safe user object (without sensitive data)
 * @returns {Object}
 */
userSchema.methods.toSafeObject = function () {
    return {
        id: this._id,
        username: this.username,
        email: this.email,
        role: this.role,
        fullName: this.fullName,
        departmentId: this.departmentId,
        isActive: this.isActive,
        createdAt: this.createdAt,
        lastLogin: this.lastLogin
    };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Find user by username and verify password
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByCredentials = async function (username, password) {
    const user = await this.findOne({ username, isActive: true }).select('+password');

    if (!user) {
        return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return null;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
