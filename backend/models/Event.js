/**
 * Procurement Event Model
 * 
 * The core data model for the procurement monitoring system.
 * Each event represents a single step in the procurement lifecycle.
 * 
 * CRITICAL: This collection is treated as APPEND-ONLY.
 * - No update operations are permitted
 * - No delete operations are permitted
 * - Each event is hash-chained to the previous event
 * 
 * The hash chain provides tamper-evidence: any modification
 * to historical events will break the chain and be detectable.
 */

const mongoose = require('mongoose');
const { EVENT_TYPES, LEDGER } = require('../config/constants');

const eventSchema = new mongoose.Schema({
    // ============================================
    // IDENTIFICATION
    // ============================================

    // Unique identifier for this event (UUID v4)
    event_id: {
        type: String,
        required: [true, 'Event ID is required'],
        unique: true,
        immutable: true
    },

    // Reference to the tender this event belongs to
    tender_id: {
        type: String,
        required: [true, 'Tender ID is required'],
        index: true,
        immutable: true
    },

    // ============================================
    // EVENT CLASSIFICATION
    // ============================================

    // Type of procurement lifecycle event
    event_type: {
        type: String,
        enum: {
            values: Object.values(EVENT_TYPES),
            message: 'Invalid event type'
        },
        required: [true, 'Event type is required'],
        immutable: true
    },

    // ============================================
    // PARTIES INVOLVED
    // ============================================

    // Supplier associated with this event (null for TENDER_CREATED)
    supplier_id: {
        type: String,
        default: null,
        index: true,
        immutable: true
    },

    // Department that owns this procurement
    department_id: {
        type: String,
        required: [true, 'Department ID is required'],
        index: true,
        immutable: true
    },

    // ============================================
    // BID INFORMATION
    // ============================================

    // Number of bids received (for BID_SUBMITTED, AWARD_GRANTED)
    bid_count: {
        type: Number,
        default: null,
        min: [0, 'Bid count cannot be negative'],
        immutable: true
    },

    // Rank of awarded supplier (1 = lowest bidder, etc.)
    award_rank: {
        type: Number,
        default: null,
        min: [1, 'Award rank must be at least 1'],
        immutable: true
    },

    // ============================================
    // FINANCIAL DATA
    // ============================================

    // Contract value (for AWARD_GRANTED, CONTRACT_UPDATED)
    contract_amount: {
        type: Number,
        default: null,
        min: [0, 'Contract amount cannot be negative'],
        immutable: true
    },

    // Payment disbursed (for PAYMENT_MADE)
    payment_amount: {
        type: Number,
        default: null,
        min: [0, 'Payment amount cannot be negative'],
        immutable: true
    },

    // Currency code (ISO 4217)
    currency: {
        type: String,
        default: 'INR',
        uppercase: true,
        minlength: 3,
        maxlength: 3,
        immutable: true
    },

    // ============================================
    // TEMPORAL DATA
    // ============================================

    // Date the event occurred
    event_date: {
        type: Date,
        required: [true, 'Event date is required'],
        immutable: true
    },

    // Fiscal period in YYYY-QX format (e.g., "2024-Q3")
    fiscal_period: {
        type: String,
        required: [true, 'Fiscal period is required'],
        match: [/^\d{4}-Q[1-4]$/, 'Fiscal period must be in YYYY-QX format'],
        index: true,
        immutable: true
    },

    // ============================================
    // AUDIT TRAIL
    // ============================================

    // User ID who entered this event
    entered_by: {
        type: String,
        required: [true, 'Entered by user ID is required'],
        immutable: true
    },

    // Timestamp when event was recorded in the system
    recorded_at: {
        type: Date,
        default: Date.now,
        immutable: true
    },

    // ============================================
    // HASH CHAIN (TAMPER-EVIDENCE)
    // ============================================

    // Hash of the immediately previous event (null for genesis)
    previous_event_hash: {
        type: String,
        default: null,
        immutable: true
    },

    // SHA-256 hash of this event's data + previous_event_hash
    event_hash: {
        type: String,
        required: [true, 'Event hash is required'],
        unique: true,
        immutable: true
    },

    // Sequence number in the ledger (for ordering verification)
    sequence_number: {
        type: Number,
        required: true,
        unique: true,
        immutable: true
    }
}, {
    timestamps: false, // We use recorded_at for audit purposes

    // Disable version key since we don't allow updates
    versionKey: false,

    // Ensure all fields are immutable at schema level
    strict: 'throw'
});

// ============================================
// INDEXES FOR QUERY OPTIMIZATION
// ============================================
eventSchema.index({ event_date: 1 });
eventSchema.index({ recorded_at: 1 });
// Note: sequence_number already has unique: true in schema, no need for separate index
eventSchema.index({ department_id: 1, supplier_id: 1 });
eventSchema.index({ department_id: 1, event_date: 1 });
eventSchema.index({ supplier_id: 1, event_date: 1 });
eventSchema.index({ tender_id: 1, event_date: 1 });
eventSchema.index({ event_type: 1, event_date: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================

/**
 * Get the fiscal year from fiscal_period
 */
eventSchema.virtual('fiscalYear').get(function () {
    if (!this.fiscal_period) return null;
    return parseInt(this.fiscal_period.split('-')[0], 10);
});

/**
 * Get the fiscal quarter from fiscal_period
 */
eventSchema.virtual('fiscalQuarter').get(function () {
    if (!this.fiscal_period) return null;
    return parseInt(this.fiscal_period.split('-Q')[1], 10);
});

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get the last event in the ledger
 * @returns {Promise<Event|null>}
 */
eventSchema.statics.getLastEvent = async function () {
    return this.findOne()
        .sort({ sequence_number: -1 })
        .limit(1);
};

/**
 * Get all events for a specific tender, ordered chronologically
 * @param {string} tenderId 
 * @returns {Promise<Event[]>}
 */
eventSchema.statics.getTenderLifecycle = async function (tenderId) {
    return this.find({ tender_id: tenderId })
        .sort({ event_date: 1, sequence_number: 1 });
};

/**
 * Get events in a date range for a department
 * @param {string} departmentId 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Event[]>}
 */
eventSchema.statics.getDepartmentEvents = async function (departmentId, startDate, endDate) {
    return this.find({
        department_id: departmentId,
        event_date: { $gte: startDate, $lte: endDate }
    }).sort({ event_date: 1 });
};

/**
 * Get award events for a supplier in a rolling window
 * @param {string} supplierId 
 * @param {Date} since 
 * @returns {Promise<Event[]>}
 */
eventSchema.statics.getSupplierAwards = async function (supplierId, since) {
    return this.find({
        supplier_id: supplierId,
        event_type: 'AWARD_GRANTED',
        event_date: { $gte: since }
    }).sort({ event_date: 1 });
};

/**
 * Convert event to a canonical object for hashing
 * Excludes computed fields like _id and includes only data fields
 * @param {Object} eventData - Raw event data
 * @returns {Object} - Canonical representation
 */
eventSchema.statics.toCanonicalForm = function (eventData) {
    // Only include fields that constitute the event content
    // Order is deterministic (alphabetical) for consistent hashing
    return {
        award_rank: eventData.award_rank ?? null,
        bid_count: eventData.bid_count ?? null,
        contract_amount: eventData.contract_amount ?? null,
        currency: eventData.currency || 'INR',
        department_id: eventData.department_id,
        entered_by: eventData.entered_by,
        event_date: eventData.event_date instanceof Date
            ? eventData.event_date.toISOString()
            : eventData.event_date,
        event_id: eventData.event_id,
        event_type: eventData.event_type,
        fiscal_period: eventData.fiscal_period,
        payment_amount: eventData.payment_amount ?? null,
        previous_event_hash: eventData.previous_event_hash ?? null,
        sequence_number: eventData.sequence_number,
        supplier_id: eventData.supplier_id ?? null,
        tender_id: eventData.tender_id
    };
};

// ============================================
// PREVENT UPDATES AND DELETES
// ============================================

// Disable updateOne
eventSchema.pre('updateOne', function (next) {
    const error = new Error('LEDGER_VIOLATION: Update operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable updateMany
eventSchema.pre('updateMany', function (next) {
    const error = new Error('LEDGER_VIOLATION: Update operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable findOneAndUpdate
eventSchema.pre('findOneAndUpdate', function (next) {
    const error = new Error('LEDGER_VIOLATION: Update operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable deleteOne
eventSchema.pre('deleteOne', function (next) {
    const error = new Error('LEDGER_VIOLATION: Delete operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable deleteMany
eventSchema.pre('deleteMany', function (next) {
    const error = new Error('LEDGER_VIOLATION: Delete operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable findOneAndDelete
eventSchema.pre('findOneAndDelete', function (next) {
    const error = new Error('LEDGER_VIOLATION: Delete operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable findByIdAndUpdate
eventSchema.pre('findByIdAndUpdate', function (next) {
    const error = new Error('LEDGER_VIOLATION: Update operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

// Disable findByIdAndDelete
eventSchema.pre('findByIdAndDelete', function (next) {
    const error = new Error('LEDGER_VIOLATION: Delete operations are not permitted on the event ledger');
    error.code = 'LEDGER_IMMUTABLE';
    next(error);
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
