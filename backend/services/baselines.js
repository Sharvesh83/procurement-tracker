/**
 * Baseline Computation Service
 * 
 * Computes and stores historical baselines for risk analysis.
 * Baselines are calculated over rolling time windows and include:
 * 
 * - Department averages (contract values, bid counts, spending)
 * - Supplier averages (contract values, win rates)
 * - Fiscal period patterns (seasonal spending trends)
 * 
 * These baselines enable the risk engine to detect anomalies
 * by comparing current values against historical norms.
 */

const Event = require('../models/Event');
const Baseline = require('../models/Baseline');
const { BASELINE_PARAMS, EVENT_TYPES } = require('../config/constants');

/**
 * Calculate standard deviation for an array of numbers
 * @param {number[]} values 
 * @returns {number}
 */
const calculateStdDev = (values) => {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(variance);
};

/**
 * Calculate statistics from a set of numeric values
 * @param {number[]} values 
 * @returns {Object}
 */
const calculateStats = (values) => {
    const filtered = values.filter(v => v !== null && v !== undefined && !isNaN(v));

    if (filtered.length === 0) {
        return {
            avg: 0,
            stddev: 0,
            min: 0,
            max: 0,
            total: 0,
            count: 0
        };
    }

    const sum = filtered.reduce((acc, v) => acc + v, 0);
    const avg = sum / filtered.length;

    return {
        avg,
        stddev: calculateStdDev(filtered),
        min: Math.min(...filtered),
        max: Math.max(...filtered),
        total: sum,
        count: filtered.length
    };
};

/**
 * Get the date for the start of a rolling window
 * @param {number} months - Number of months back
 * @returns {Date}
 */
const getWindowStartDate = (months = BASELINE_PARAMS.ROLLING_WINDOW_MONTHS) => {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date;
};

/**
 * Compute baseline for a specific department
 * @param {string} departmentId 
 * @returns {Promise<Object>}
 */
const computeDepartmentBaseline = async (departmentId) => {
    const windowStart = getWindowStartDate();
    const windowEnd = new Date();

    // Get all award events for this department in the window
    const events = await Event.find({
        department_id: departmentId,
        event_type: EVENT_TYPES.AWARD_GRANTED,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    // Get bid events to calculate average bid count
    const bidEvents = await Event.find({
        department_id: departmentId,
        event_type: EVENT_TYPES.BID_SUBMITTED,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    // Calculate contract value statistics
    const contractAmounts = events.map(e => e.contract_amount).filter(a => a !== null);
    const contractStats = calculateStats(contractAmounts);

    // Calculate bid count statistics
    const bidCounts = events.map(e => e.bid_count).filter(b => b !== null);
    const avgBidCount = bidCounts.length > 0
        ? bidCounts.reduce((sum, b) => sum + b, 0) / bidCounts.length
        : 0;

    // Count unique suppliers
    const supplierIds = new Set(events.filter(e => e.supplier_id).map(e => e.supplier_id));

    // Count tenders
    const tenderIds = new Set(events.map(e => e.tender_id));

    // Get payment events
    const paymentEvents = await Event.find({
        department_id: departmentId,
        event_type: EVENT_TYPES.PAYMENT_MADE,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    const baseline = {
        baseline_type: 'DEPARTMENT',
        entity_id: departmentId,
        window_start: windowStart,
        window_end: windowEnd,
        contract_avg: contractStats.avg,
        contract_stddev: contractStats.stddev,
        contract_min: contractStats.min,
        contract_max: contractStats.max,
        contract_total: contractStats.total,
        contract_count: contractStats.count,
        tender_count: tenderIds.size,
        payment_count: paymentEvents.length,
        supplier_count: supplierIds.size,
        avg_bid_count: avgBidCount,
        computed_at: new Date(),
        sample_count: events.length,
        is_reliable: events.length >= BASELINE_PARAMS.MIN_SAMPLES_REQUIRED
    };

    // Save or update baseline
    await Baseline.findOneAndUpdate(
        { baseline_type: 'DEPARTMENT', entity_id: departmentId },
        baseline,
        { upsert: true, new: true }
    );

    return baseline;
};

/**
 * Compute baseline for a specific supplier
 * @param {string} supplierId 
 * @returns {Promise<Object>}
 */
const computeSupplierBaseline = async (supplierId) => {
    const windowStart = getWindowStartDate();
    const windowEnd = new Date();

    // Get all award events for this supplier in the window
    const awards = await Event.find({
        supplier_id: supplierId,
        event_type: EVENT_TYPES.AWARD_GRANTED,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    // Get bid events for this supplier to calculate win rate
    const bids = await Event.find({
        supplier_id: supplierId,
        event_type: EVENT_TYPES.BID_SUBMITTED,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    // Calculate contract value statistics
    const contractAmounts = awards.map(e => e.contract_amount).filter(a => a !== null);
    const contractStats = calculateStats(contractAmounts);

    // Calculate win rate
    const uniqueBidTenders = new Set(bids.map(b => b.tender_id));
    const uniqueWonTenders = new Set(awards.map(a => a.tender_id));
    const winRate = uniqueBidTenders.size > 0
        ? uniqueWonTenders.size / uniqueBidTenders.size
        : 0;

    // Count unique departments
    const departmentIds = new Set(awards.map(e => e.department_id));

    // Get payment events
    const payments = await Event.find({
        supplier_id: supplierId,
        event_type: EVENT_TYPES.PAYMENT_MADE,
        event_date: { $gte: windowStart, $lte: windowEnd }
    }).lean();

    const baseline = {
        baseline_type: 'SUPPLIER',
        entity_id: supplierId,
        window_start: windowStart,
        window_end: windowEnd,
        contract_avg: contractStats.avg,
        contract_stddev: contractStats.stddev,
        contract_min: contractStats.min,
        contract_max: contractStats.max,
        contract_total: contractStats.total,
        contract_count: contractStats.count,
        tender_count: uniqueWonTenders.size,
        payment_count: payments.length,
        win_rate: winRate,
        department_count: departmentIds.size,
        computed_at: new Date(),
        sample_count: awards.length,
        is_reliable: awards.length >= BASELINE_PARAMS.MIN_SAMPLES_REQUIRED
    };

    // Save or update baseline
    await Baseline.findOneAndUpdate(
        { baseline_type: 'SUPPLIER', entity_id: supplierId },
        baseline,
        { upsert: true, new: true }
    );

    return baseline;
};

/**
 * Compute baselines for a fiscal period
 * @param {string} fiscalPeriod - Format: YYYY-QX
 * @returns {Promise<Object>}
 */
const computePeriodBaseline = async (fiscalPeriod) => {
    // Parse fiscal period
    const [year, quarter] = fiscalPeriod.split('-Q');
    const quarterNum = parseInt(quarter, 10);

    // Calculate period boundaries
    const startMonth = (quarterNum - 1) * 3;
    const windowStart = new Date(parseInt(year, 10), startMonth, 1);
    const windowEnd = new Date(parseInt(year, 10), startMonth + 3, 0);

    // Get all spending events in this period
    const events = await Event.find({
        fiscal_period: fiscalPeriod,
        event_type: { $in: [EVENT_TYPES.AWARD_GRANTED, EVENT_TYPES.PAYMENT_MADE] }
    }).lean();

    // Calculate daily spending
    const daysInPeriod = Math.ceil((windowEnd - windowStart) / (1000 * 60 * 60 * 24));
    const contractAmounts = events
        .filter(e => e.event_type === EVENT_TYPES.AWARD_GRANTED && e.contract_amount)
        .map(e => e.contract_amount);
    const totalSpending = contractAmounts.reduce((sum, v) => sum + v, 0);
    const dailySpendingAvg = daysInPeriod > 0 ? totalSpending / daysInPeriod : 0;

    const contractStats = calculateStats(contractAmounts);

    const baseline = {
        baseline_type: 'PERIOD',
        entity_id: fiscalPeriod,
        window_start: windowStart,
        window_end: windowEnd,
        fiscal_period: fiscalPeriod,
        contract_avg: contractStats.avg,
        contract_stddev: contractStats.stddev,
        contract_min: contractStats.min,
        contract_max: contractStats.max,
        contract_total: contractStats.total,
        contract_count: contractStats.count,
        tender_count: new Set(events.map(e => e.tender_id)).size,
        payment_count: events.filter(e => e.event_type === EVENT_TYPES.PAYMENT_MADE).length,
        daily_spending_avg: dailySpendingAvg,
        computed_at: new Date(),
        sample_count: events.length,
        is_reliable: events.length >= BASELINE_PARAMS.MIN_SAMPLES_REQUIRED
    };

    // Save or update baseline
    await Baseline.findOneAndUpdate(
        { baseline_type: 'PERIOD', entity_id: fiscalPeriod },
        baseline,
        { upsert: true, new: true }
    );

    return baseline;
};

/**
 * Recompute all baselines
 * This is typically run as a scheduled job
 * @returns {Promise<Object>}
 */
const recomputeAllBaselines = async () => {
    const startTime = Date.now();
    const result = {
        departments: 0,
        suppliers: 0,
        periods: 0,
        errors: []
    };

    try {
        // Get unique department IDs
        const departments = await Event.distinct('department_id');
        for (const deptId of departments) {
            try {
                await computeDepartmentBaseline(deptId);
                result.departments++;
            } catch (error) {
                result.errors.push({ type: 'DEPARTMENT', entity: deptId, error: error.message });
            }
        }

        // Get unique supplier IDs
        const suppliers = await Event.distinct('supplier_id', { supplier_id: { $ne: null } });
        for (const supplierId of suppliers) {
            try {
                await computeSupplierBaseline(supplierId);
                result.suppliers++;
            } catch (error) {
                result.errors.push({ type: 'SUPPLIER', entity: supplierId, error: error.message });
            }
        }

        // Get unique fiscal periods
        const periods = await Event.distinct('fiscal_period');
        for (const period of periods) {
            try {
                await computePeriodBaseline(period);
                result.periods++;
            } catch (error) {
                result.errors.push({ type: 'PERIOD', entity: period, error: error.message });
            }
        }

    } catch (error) {
        result.errors.push({ type: 'GENERAL', error: error.message });
    }

    result.duration_ms = Date.now() - startTime;
    return result;
};

/**
 * Get baseline for an entity
 * @param {string} type - DEPARTMENT, SUPPLIER, or PERIOD
 * @param {string} entityId 
 * @returns {Promise<Object|null>}
 */
const getBaseline = async (type, entityId) => {
    return Baseline.getLatestBaseline(type, entityId);
};

module.exports = {
    computeDepartmentBaseline,
    computeSupplierBaseline,
    computePeriodBaseline,
    recomputeAllBaselines,
    getBaseline,
    calculateStats,
    calculateStdDev
};
