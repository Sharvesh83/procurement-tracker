/**
 * Data Ingestion Service
 * 
 * Converts raw procurement data into validated event format
 * for insertion into the tamper-evident ledger.
 * 
 * Supports:
 * - Synthetic test data generation
 * - Public procurement dataset import
 * - Manual event creation
 */

const { v4: uuidv4 } = require('uuid');
const { EVENT_TYPES } = require('../config/constants');

/**
 * Generate the fiscal period for a given date
 * @param {Date} date 
 * @returns {string} Format: YYYY-QX
 */
const getFiscalPeriod = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
};

/**
 * Validate and normalize event data
 * @param {Object} rawData 
 * @returns {Object} Normalized event data
 */
const normalizeEventData = (rawData) => {
    // Validate required fields
    if (!rawData.tender_id) {
        throw new Error('Tender ID is required');
    }

    if (!rawData.event_type) {
        throw new Error('Event type is required');
    }

    if (!Object.values(EVENT_TYPES).includes(rawData.event_type)) {
        throw new Error(`Invalid event type: ${rawData.event_type}`);
    }

    if (!rawData.department_id) {
        throw new Error('Department ID is required');
    }

    // Parse and validate event date
    const eventDate = rawData.event_date ? new Date(rawData.event_date) : new Date();
    if (isNaN(eventDate.getTime())) {
        throw new Error('Invalid event date');
    }

    // Generate fiscal period if not provided
    const fiscalPeriod = rawData.fiscal_period || getFiscalPeriod(eventDate);

    // Validate fiscal period format
    if (!/^\d{4}-Q[1-4]$/.test(fiscalPeriod)) {
        throw new Error('Fiscal period must be in YYYY-QX format');
    }

    return {
        tender_id: rawData.tender_id.toString().trim(),
        event_type: rawData.event_type,
        supplier_id: rawData.supplier_id ? rawData.supplier_id.toString().trim() : null,
        department_id: rawData.department_id.toString().trim(),
        bid_count: rawData.bid_count !== undefined ? parseInt(rawData.bid_count, 10) : null,
        award_rank: rawData.award_rank !== undefined ? parseInt(rawData.award_rank, 10) : null,
        contract_amount: rawData.contract_amount !== undefined ? parseFloat(rawData.contract_amount) : null,
        payment_amount: rawData.payment_amount !== undefined ? parseFloat(rawData.payment_amount) : null,
        currency: rawData.currency ? rawData.currency.toString().toUpperCase().trim() : 'INR',
        event_date: eventDate.toISOString(),
        fiscal_period: fiscalPeriod
    };
};

/**
 * Convert a batch of raw data to events
 * @param {Array} rawDataArray 
 * @returns {Object} Result with successful and failed conversions
 */
const convertBatchToEvents = (rawDataArray) => {
    const results = {
        successful: [],
        failed: []
    };

    for (let i = 0; i < rawDataArray.length; i++) {
        try {
            const normalized = normalizeEventData(rawDataArray[i]);
            results.successful.push({
                index: i,
                data: normalized
            });
        } catch (error) {
            results.failed.push({
                index: i,
                error: error.message,
                originalData: rawDataArray[i]
            });
        }
    }

    return results;
};

/**
 * Synthetic data generator for testing
 */
const syntheticDataGenerator = {
    // Department configurations
    departments: [
        { id: 'DEPT-PUBLIC-WORKS', name: 'Public Works Department' },
        { id: 'DEPT-HEALTH', name: 'Health Department' },
        { id: 'DEPT-EDUCATION', name: 'Education Department' },
        { id: 'DEPT-TRANSPORT', name: 'Transport Department' },
        { id: 'DEPT-IT', name: 'IT Department' }
    ],

    // Supplier configurations
    suppliers: [
        { id: 'SUP-001', name: 'Alpha Construction Ltd' },
        { id: 'SUP-002', name: 'Beta Supplies Inc' },
        { id: 'SUP-003', name: 'Gamma Services Corp' },
        { id: 'SUP-004', name: 'Delta Infrastructure' },
        { id: 'SUP-005', name: 'Epsilon Technologies' },
        { id: 'SUP-006', name: 'Zeta Consulting' },
        { id: 'SUP-007', name: 'Eta Solutions' },
        { id: 'SUP-008', name: 'Theta Enterprises' }
    ],

    /**
     * Generate a deterministic random number based on seed
     * Uses a simple linear congruential generator for reproducibility
     * @param {number} seed 
     * @returns {number} Between 0 and 1
     */
    seededRandom: function (seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },

    /**
     * Generate a complete tender lifecycle
     * @param {number} tenderNumber - Seed for reproducibility
     * @param {Object} options - Configuration options
     * @returns {Array<Object>} Array of events
     */
    generateTenderLifecycle: function (tenderNumber, options = {}) {
        const events = [];
        const seed = tenderNumber * 1000;

        const tenderId = `TND-${new Date().getFullYear()}-${String(tenderNumber).padStart(5, '0')}`;

        // Select department deterministically
        const deptIndex = Math.floor(this.seededRandom(seed) * this.departments.length);
        const department = this.departments[deptIndex];

        // Determine base date
        const baseDate = options.baseDate || new Date();
        const tenderDate = new Date(baseDate);
        tenderDate.setDate(tenderDate.getDate() - Math.floor(this.seededRandom(seed + 1) * 180));

        // Event 1: Tender Created
        events.push({
            tender_id: tenderId,
            event_type: EVENT_TYPES.TENDER_CREATED,
            department_id: department.id,
            supplier_id: null,
            event_date: new Date(tenderDate).toISOString(),
            fiscal_period: getFiscalPeriod(tenderDate)
        });

        // Determine number of bids (deterministic)
        const bidCount = 1 + Math.floor(this.seededRandom(seed + 2) * 6);

        // Event 2-N: Bid Submissions
        const bidders = [];
        for (let i = 0; i < bidCount; i++) {
            const supplierIndex = Math.floor(this.seededRandom(seed + 10 + i) * this.suppliers.length);
            const supplier = this.suppliers[supplierIndex];

            if (!bidders.some(b => b.id === supplier.id)) {
                bidders.push(supplier);

                const bidDate = new Date(tenderDate);
                bidDate.setDate(bidDate.getDate() + 7 + Math.floor(this.seededRandom(seed + 20 + i) * 14));

                events.push({
                    tender_id: tenderId,
                    event_type: EVENT_TYPES.BID_SUBMITTED,
                    department_id: department.id,
                    supplier_id: supplier.id,
                    bid_count: bidders.length,
                    event_date: new Date(bidDate).toISOString(),
                    fiscal_period: getFiscalPeriod(bidDate)
                });
            }
        }

        // Event: Award Granted
        if (bidders.length > 0) {
            const winnerIndex = Math.floor(this.seededRandom(seed + 100) * bidders.length);
            const winner = bidders[winnerIndex];

            // Generate contract amount deterministically
            const baseAmount = 100000 + this.seededRandom(seed + 200) * 900000;
            const contractAmount = Math.round(baseAmount / 1000) * 1000;

            const awardDate = new Date(tenderDate);
            awardDate.setDate(awardDate.getDate() + 28 + Math.floor(this.seededRandom(seed + 101) * 14));

            events.push({
                tender_id: tenderId,
                event_type: EVENT_TYPES.AWARD_GRANTED,
                department_id: department.id,
                supplier_id: winner.id,
                bid_count: bidders.length,
                award_rank: 1,
                contract_amount: contractAmount,
                currency: 'INR',
                event_date: new Date(awardDate).toISOString(),
                fiscal_period: getFiscalPeriod(awardDate)
            });

            // Event: Payment(s)
            const numPayments = 1 + Math.floor(this.seededRandom(seed + 300) * 3);
            let remainingAmount = contractAmount;

            for (let i = 0; i < numPayments; i++) {
                const paymentDate = new Date(awardDate);
                paymentDate.setDate(paymentDate.getDate() + 30 * (i + 1));

                const isLastPayment = i === numPayments - 1;
                const paymentAmount = isLastPayment
                    ? remainingAmount
                    : Math.round((contractAmount / numPayments) / 1000) * 1000;

                remainingAmount -= paymentAmount;

                events.push({
                    tender_id: tenderId,
                    event_type: EVENT_TYPES.PAYMENT_MADE,
                    department_id: department.id,
                    supplier_id: winner.id,
                    payment_amount: paymentAmount,
                    currency: 'INR',
                    event_date: new Date(paymentDate).toISOString(),
                    fiscal_period: getFiscalPeriod(paymentDate)
                });
            }
        }

        return events;
    },

    /**
     * Generate multiple tender lifecycles
     * @param {number} count - Number of tenders to generate
     * @param {Object} options - Configuration options
     * @returns {Array<Object>} All events
     */
    generateBatch: function (count, options = {}) {
        let allEvents = [];

        for (let i = 1; i <= count; i++) {
            const tenderEvents = this.generateTenderLifecycle(i, options);
            allEvents = allEvents.concat(tenderEvents);
        }

        // Sort by event date for proper ledger ordering
        allEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

        return allEvents;
    }
};

module.exports = {
    normalizeEventData,
    convertBatchToEvents,
    getFiscalPeriod,
    syntheticDataGenerator
};
