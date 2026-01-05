/**
 * Baseline Model
 * 
 * Stores computed historical baselines for risk analysis.
 * These baselines are used to detect anomalies by comparing
 * current procurement patterns against historical norms.
 * 
 * Baselines are computed periodically and stored for:
 * - Departments: average contract values, spending patterns
 * - Suppliers: average contract values, win rates
 * - Time periods: seasonal spending patterns
 */

const mongoose = require('mongoose');

const baselineSchema = new mongoose.Schema({
    // ============================================
    // IDENTIFICATION
    // ============================================

    // Type of baseline: 'DEPARTMENT', 'SUPPLIER', 'PERIOD'
    baseline_type: {
        type: String,
        enum: ['DEPARTMENT', 'SUPPLIER', 'PERIOD'],
        required: [true, 'Baseline type is required'],
        index: true
    },

    // Entity this baseline applies to (department_id or supplier_id)
    entity_id: {
        type: String,
        required: [true, 'Entity ID is required'],
        index: true
    },

    // ============================================
    // TIME WINDOW
    // ============================================

    // Start of the baseline computation window
    window_start: {
        type: Date,
        required: [true, 'Window start date is required']
    },

    // End of the baseline computation window
    window_end: {
        type: Date,
        required: [true, 'Window end date is required']
    },

    // ============================================
    // CONTRACT VALUE STATISTICS
    // ============================================

    // Average contract value in the window
    contract_avg: {
        type: Number,
        default: 0,
        min: 0
    },

    // Standard deviation of contract values
    contract_stddev: {
        type: Number,
        default: 0,
        min: 0
    },

    // Minimum contract value observed
    contract_min: {
        type: Number,
        default: 0,
        min: 0
    },

    // Maximum contract value observed
    contract_max: {
        type: Number,
        default: 0,
        min: 0
    },

    // Total contract value in window
    contract_total: {
        type: Number,
        default: 0,
        min: 0
    },

    // ============================================
    // COUNT STATISTICS
    // ============================================

    // Number of contracts/awards in the window
    contract_count: {
        type: Number,
        default: 0,
        min: 0
    },

    // Number of tenders in the window
    tender_count: {
        type: Number,
        default: 0,
        min: 0
    },

    // Number of payments in the window
    payment_count: {
        type: Number,
        default: 0,
        min: 0
    },

    // ============================================
    // SUPPLIER-SPECIFIC METRICS (for SUPPLIER type)
    // ============================================

    // Win rate: awards received / total tenders bid on
    win_rate: {
        type: Number,
        default: null,
        min: 0,
        max: 1
    },

    // Number of unique departments this supplier works with
    department_count: {
        type: Number,
        default: null,
        min: 0
    },

    // ============================================
    // DEPARTMENT-SPECIFIC METRICS (for DEPARTMENT type)
    // ============================================

    // Number of unique suppliers awarded contracts
    supplier_count: {
        type: Number,
        default: null,
        min: 0
    },

    // Average number of bids per tender
    avg_bid_count: {
        type: Number,
        default: null,
        min: 0
    },

    // ============================================
    // PERIOD-SPECIFIC METRICS (for PERIOD type)
    // ============================================

    // Fiscal period this baseline applies to
    fiscal_period: {
        type: String,
        match: [/^\d{4}-Q[1-4]$/, 'Fiscal period must be in YYYY-QX format'],
        default: null
    },

    // Average daily spending in the period
    daily_spending_avg: {
        type: Number,
        default: null,
        min: 0
    },

    // ============================================
    // METADATA
    // ============================================

    // When this baseline was computed
    computed_at: {
        type: Date,
        default: Date.now,
        required: true
    },

    // Number of events used to compute this baseline
    sample_count: {
        type: Number,
        required: [true, 'Sample count is required'],
        min: 0
    },

    // Whether this baseline has sufficient data to be reliable
    is_reliable: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: false
});

// ============================================
// INDEXES
// ============================================
baselineSchema.index({ baseline_type: 1, entity_id: 1 });
baselineSchema.index({ entity_id: 1, window_end: -1 });
baselineSchema.index({ computed_at: -1 });
baselineSchema.index({ baseline_type: 1, computed_at: -1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get the most recent baseline for an entity
 * @param {string} type - Baseline type
 * @param {string} entityId - Entity identifier
 * @returns {Promise<Baseline|null>}
 */
baselineSchema.statics.getLatestBaseline = async function (type, entityId) {
    return this.findOne({
        baseline_type: type,
        entity_id: entityId,
        is_reliable: true
    }).sort({ window_end: -1 });
};

/**
 * Get all department baselines
 * @returns {Promise<Baseline[]>}
 */
baselineSchema.statics.getAllDepartmentBaselines = async function () {
    return this.find({
        baseline_type: 'DEPARTMENT',
        is_reliable: true
    }).sort({ entity_id: 1, window_end: -1 });
};

/**
 * Get all supplier baselines
 * @returns {Promise<Baseline[]>}
 */
baselineSchema.statics.getAllSupplierBaselines = async function () {
    return this.find({
        baseline_type: 'SUPPLIER',
        is_reliable: true
    }).sort({ entity_id: 1, window_end: -1 });
};

const Baseline = mongoose.model('Baseline', baselineSchema);

module.exports = Baseline;
