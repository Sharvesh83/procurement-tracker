/**
 * Authentication Routes
 * 
 * Provides user registration and login endpoints.
 * Issues JWT tokens for authenticated sessions.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateUserRegistration, validateLogin } = require('../middleware/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

// Token expiration time (24 hours)
const TOKEN_EXPIRY = '24h';

/**
 * POST /api/auth/register
 * Register a new user
 * 
 * Body: { username, password, email?, role?, fullName?, departmentId? }
 */
router.post('/register', validateUserRegistration, async (req, res) => {
    try {
        const { username, password, email, role, fullName, departmentId } = req.body;

        // Check if username already exists
        const existingUser = await User.findOne({
            $or: [
                { username },
                ...(email ? [{ email }] : [])
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'USER_EXISTS',
                message: existingUser.username === username
                    ? 'Username already taken'
                    : 'Email already registered'
            });
        }

        // Create new user
        const user = new User({
            username,
            password,
            email,
            role: role || ROLES.AUDITOR,
            fullName,
            departmentId
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: user.toSafeObject(),
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'REGISTRATION_FAILED',
            message: 'Failed to register user'
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT token
 * 
 * Body: { username, password }
 */
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user by credentials
        const user = await User.findByCredentials(username, password);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_CREDENTIALS',
                message: 'Invalid username or password'
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.toSafeObject(),
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'LOGIN_FAILED',
            message: 'Failed to authenticate'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 * Requires authentication
 */
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user.toSafeObject()
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'PROFILE_FETCH_FAILED',
            message: 'Failed to fetch profile'
        });
    }
});

module.exports = router;
