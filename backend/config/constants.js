/**
 * Application Constants
 * 
 * Central location for all magic numbers and configuration values.
 * Each constant is documented to explain its purpose and rationale.
 */

module.exports = {
    // ============================================
    // ROLE DEFINITIONS
    // ============================================
    ROLES: {
        PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER', // Can submit procurement events
        AUDITOR: 'AUDITOR'                          // Read-only access for review
    },

    // ============================================
    // EVENT TYPES - Procurement Lifecycle Stages
    // ============================================
    EVENT_TYPES: {
        TENDER_CREATED: 'TENDER_CREATED',       // Initial tender announcement
        BID_SUBMITTED: 'BID_SUBMITTED',         // Supplier submits a bid
        AWARD_GRANTED: 'AWARD_GRANTED',         // Contract awarded to supplier
        PAYMENT_MADE: 'PAYMENT_MADE',           // Payment disbursed
        CONTRACT_UPDATED: 'CONTRACT_UPDATED'    // Contract modification/amendment
    },

    // ============================================
    // RISK SEVERITY LEVELS
    // ============================================
    SEVERITY: {
        LOW: 'LOW',       // Minor anomaly, informational
        MEDIUM: 'MEDIUM', // Notable pattern, warrants review
        HIGH: 'HIGH'      // Significant deviation, priority review
    },

    // ============================================
    // RISK SCORING VALUES
    // Points assigned to each severity level for
    // computing aggregate risk scores
    // ============================================
    RISK_POINTS: {
        LOW: 10,    // Low severity contribution
        MEDIUM: 20, // Medium severity contribution  
        HIGH: 30    // High severity contribution
    },

    // ============================================
    // RISK SCORE THRESHOLDS
    // Used to categorize overall tender risk level
    // ============================================
    RISK_THRESHOLDS: {
        LOW_MAX: 20,      // 0-20 points = Low risk
        MEDIUM_MAX: 50    // 21-50 points = Medium risk, 51+ = High risk
    },

    // ============================================
    // RISK DETECTION PARAMETERS
    // Thresholds for each risk detection rule
    // ============================================
    RISK_PARAMS: {
        // Supplier Dominance: supplier wins >60% of department tenders
        SUPPLIER_DOMINANCE_THRESHOLD: 0.60,
        SUPPLIER_DOMINANCE_WINDOW_MONTHS: 12,

        // Low Competition: 2 or fewer bids is considered low
        LOW_COMPETITION_MAX_BIDS: 2,

        // Amount Deviation: contract exceeds mean + 2 standard deviations
        AMOUNT_DEVIATION_SIGMA: 2,

        // Supplier Price Inflation: >50% above supplier's rolling average
        PRICE_INFLATION_THRESHOLD: 0.50,

        // Rapid Sequential Awards: 2+ contracts within 14 days
        RAPID_AWARD_MIN_COUNT: 2,
        RAPID_AWARD_WINDOW_DAYS: 14,

        // Payment Fragmentation: multiple payments in short period
        PAYMENT_FRAGMENT_WINDOW_DAYS: 7,
        PAYMENT_FRAGMENT_MIN_COUNT: 3,

        // End-of-Period Spike: spending near fiscal end exceeds 2x average
        END_OF_PERIOD_DAYS: 14,
        END_OF_PERIOD_SPIKE_MULTIPLIER: 2.0
    },

    // ============================================
    // BASELINE COMPUTATION PARAMETERS
    // ============================================
    BASELINE_PARAMS: {
        ROLLING_WINDOW_MONTHS: 12,  // Default window for baseline computation
        MIN_SAMPLES_REQUIRED: 3     // Minimum events needed for reliable baseline
    },

    // ============================================
    // LEDGER VERIFICATION
    // ============================================
    LEDGER: {
        HASH_ALGORITHM: 'sha256',
        GENESIS_PREVIOUS_HASH: null  // First event has no predecessor
    },

    // ============================================
    // API CONFIGURATION
    // ============================================
    API: {
        DEFAULT_PAGE_SIZE: 50,
        MAX_PAGE_SIZE: 100
    }
};
