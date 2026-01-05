/**
 * Risk Analysis Engine
 * 
 * Deterministic, rule-based risk detection for procurement events.
 * 
 * CRITICAL DESIGN PRINCIPLES:
 * 1. NO randomness or probabilistic outputs
 * 2. Every flag includes a clear, human-readable explanation
 * 3. All thresholds are configurable and documented
 * 4. Flags indicate patterns for review, NOT accusations
 * 
 * RISK DETECTION RULES:
 * 1. Supplier Dominance - Same supplier wins >60% of tenders in a department
 * 2. Low Competition - Award granted with 2 or fewer bids
 * 3. Amount Deviation - Contract exceeds department mean + 2σ
 * 4. Supplier Price Inflation - Contract >50% above supplier's rolling average
 * 5. Rapid Sequential Awards - Same supplier gets 2+ contracts in 14 days
 * 6. Payment Fragmentation - Multiple payments totaling above typical contract
 * 7. End-of-Period Spike - Spending near fiscal period end exceeds 2x average
 * 
 * DISCLAIMER: This system does NOT determine corruption.
 * It highlights abnormal procurement patterns for human review.
 */

const Event = require('../models/Event');
const Baseline = require('../models/Baseline');
const { RISK_PARAMS, SEVERITY, RISK_POINTS, RISK_THRESHOLDS, EVENT_TYPES } = require('../config/constants');

/**
 * Create a risk flag object
 * @param {string} riskType - Type of risk detected
 * @param {string} severity - LOW, MEDIUM, or HIGH
 * @param {string} explanation - Human-readable explanation
 * @param {Object} details - Additional data for context
 * @returns {Object}
 */
const createFlag = (riskType, severity, explanation, details = {}) => {
    return {
        risk_type: riskType,
        severity,
        explanation,
        details,
        points: RISK_POINTS[severity]
    };
};

/**
 * Rule 1: Supplier Dominance Detection
 * Detects when a supplier wins more than 60% of tenders in a department
 * over a 12-month rolling window.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkSupplierDominance = async (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED || !event.supplier_id) {
        return null;
    }

    const windowStart = new Date();
    windowStart.setMonth(windowStart.getMonth() - RISK_PARAMS.SUPPLIER_DOMINANCE_WINDOW_MONTHS);

    // Get all awards in this department during the window
    const departmentAwards = await Event.find({
        department_id: event.department_id,
        event_type: EVENT_TYPES.AWARD_GRANTED,
        event_date: { $gte: windowStart }
    }).lean();

    if (departmentAwards.length < 3) {
        // Not enough data to determine dominance
        return null;
    }

    // Count awards per supplier
    const supplierCounts = {};
    for (const award of departmentAwards) {
        if (award.supplier_id) {
            supplierCounts[award.supplier_id] = (supplierCounts[award.supplier_id] || 0) + 1;
        }
    }

    const supplierAwards = supplierCounts[event.supplier_id] || 0;
    const winRate = supplierAwards / departmentAwards.length;

    if (winRate > RISK_PARAMS.SUPPLIER_DOMINANCE_THRESHOLD) {
        const percentWon = (winRate * 100).toFixed(1);
        return createFlag(
            'SUPPLIER_DOMINANCE',
            SEVERITY.HIGH,
            `Supplier ${event.supplier_id} has won ${percentWon}% of contracts (${supplierAwards} of ${departmentAwards.length}) in department ${event.department_id} over the last 12 months. This exceeds the ${RISK_PARAMS.SUPPLIER_DOMINANCE_THRESHOLD * 100}% threshold.`,
            {
                supplier_id: event.supplier_id,
                department_id: event.department_id,
                win_rate: winRate,
                supplier_awards: supplierAwards,
                total_awards: departmentAwards.length,
                window_months: RISK_PARAMS.SUPPLIER_DOMINANCE_WINDOW_MONTHS,
                threshold: RISK_PARAMS.SUPPLIER_DOMINANCE_THRESHOLD
            }
        );
    }

    return null;
};

/**
 * Rule 2: Low Competition Detection
 * Flags awards granted with 2 or fewer competing bids.
 * 
 * @param {Object} event - The current event
 * @returns {Object|null}
 */
const checkLowCompetition = (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED) {
        return null;
    }

    if (event.bid_count !== null && event.bid_count <= RISK_PARAMS.LOW_COMPETITION_MAX_BIDS) {
        return createFlag(
            'LOW_COMPETITION',
            SEVERITY.MEDIUM,
            `Award granted with only ${event.bid_count} bid(s). Low competition (${RISK_PARAMS.LOW_COMPETITION_MAX_BIDS} or fewer bids) may limit value for money.`,
            {
                tender_id: event.tender_id,
                bid_count: event.bid_count,
                threshold: RISK_PARAMS.LOW_COMPETITION_MAX_BIDS
            }
        );
    }

    return null;
};

/**
 * Rule 3: Amount Deviation Detection
 * Flags contracts that exceed department average by more than 2 standard deviations.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkAmountDeviation = async (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED || event.contract_amount === null) {
        return null;
    }

    // Get department baseline
    const baseline = await Baseline.getLatestBaseline('DEPARTMENT', event.department_id);

    if (!baseline || !baseline.is_reliable || baseline.contract_avg === 0) {
        return null;
    }

    const threshold = baseline.contract_avg + (RISK_PARAMS.AMOUNT_DEVIATION_SIGMA * baseline.contract_stddev);

    if (event.contract_amount > threshold) {
        const deviation = ((event.contract_amount - baseline.contract_avg) / baseline.contract_stddev).toFixed(2);
        const percentAbove = (((event.contract_amount - baseline.contract_avg) / baseline.contract_avg) * 100).toFixed(1);

        return createFlag(
            'AMOUNT_DEVIATION',
            SEVERITY.HIGH,
            `Contract amount (${event.currency} ${event.contract_amount.toLocaleString()}) is ${deviation} standard deviations above the department average (${event.currency} ${baseline.contract_avg.toLocaleString()}). This is ${percentAbove}% above the baseline.`,
            {
                contract_amount: event.contract_amount,
                department_avg: baseline.contract_avg,
                department_stddev: baseline.contract_stddev,
                sigma_deviation: parseFloat(deviation),
                threshold_amount: threshold,
                threshold_sigma: RISK_PARAMS.AMOUNT_DEVIATION_SIGMA
            }
        );
    }

    return null;
};

/**
 * Rule 4: Supplier Price Inflation Detection
 * Flags contracts more than 50% above the supplier's rolling average.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkSupplierPriceInflation = async (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED ||
        event.contract_amount === null ||
        !event.supplier_id) {
        return null;
    }

    // Get supplier baseline
    const baseline = await Baseline.getLatestBaseline('SUPPLIER', event.supplier_id);

    if (!baseline || !baseline.is_reliable || baseline.contract_avg === 0) {
        return null;
    }

    const inflationRate = (event.contract_amount - baseline.contract_avg) / baseline.contract_avg;

    if (inflationRate > RISK_PARAMS.PRICE_INFLATION_THRESHOLD) {
        const percentAbove = (inflationRate * 100).toFixed(1);

        return createFlag(
            'SUPPLIER_PRICE_INFLATION',
            SEVERITY.MEDIUM,
            `Contract amount (${event.currency} ${event.contract_amount.toLocaleString()}) is ${percentAbove}% above supplier ${event.supplier_id}'s rolling average (${event.currency} ${baseline.contract_avg.toLocaleString()}). This exceeds the ${RISK_PARAMS.PRICE_INFLATION_THRESHOLD * 100}% threshold.`,
            {
                contract_amount: event.contract_amount,
                supplier_avg: baseline.contract_avg,
                inflation_rate: inflationRate,
                threshold: RISK_PARAMS.PRICE_INFLATION_THRESHOLD
            }
        );
    }

    return null;
};

/**
 * Rule 5: Rapid Sequential Awards Detection
 * Flags when the same supplier receives 2+ contracts in 14 days in the same department.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkRapidSequentialAwards = async (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED || !event.supplier_id) {
        return null;
    }

    const windowStart = new Date(event.event_date);
    windowStart.setDate(windowStart.getDate() - RISK_PARAMS.RAPID_AWARD_WINDOW_DAYS);

    // Find other awards to this supplier in the same department within the window
    const recentAwards = await Event.find({
        supplier_id: event.supplier_id,
        department_id: event.department_id,
        event_type: EVENT_TYPES.AWARD_GRANTED,
        event_date: { $gte: windowStart, $lte: event.event_date },
        event_id: { $ne: event.event_id } // Exclude current event
    }).lean();

    // Include current event in count
    const totalAwards = recentAwards.length + 1;

    if (totalAwards >= RISK_PARAMS.RAPID_AWARD_MIN_COUNT) {
        const tenders = [event.tender_id, ...recentAwards.map(a => a.tender_id)];

        return createFlag(
            'RAPID_SEQUENTIAL_AWARDS',
            SEVERITY.HIGH,
            `Supplier ${event.supplier_id} received ${totalAwards} contract awards in department ${event.department_id} within ${RISK_PARAMS.RAPID_AWARD_WINDOW_DAYS} days. Rapid sequential awards may indicate bid manipulation or favoritism.`,
            {
                supplier_id: event.supplier_id,
                department_id: event.department_id,
                award_count: totalAwards,
                window_days: RISK_PARAMS.RAPID_AWARD_WINDOW_DAYS,
                tender_ids: tenders,
                threshold: RISK_PARAMS.RAPID_AWARD_MIN_COUNT
            }
        );
    }

    return null;
};

/**
 * Rule 6: Payment Fragmentation Detection
 * Flags multiple payments within a short period that sum to unusual amounts.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkPaymentFragmentation = async (event) => {
    if (event.event_type !== EVENT_TYPES.PAYMENT_MADE || !event.supplier_id) {
        return null;
    }

    const windowStart = new Date(event.event_date);
    windowStart.setDate(windowStart.getDate() - RISK_PARAMS.PAYMENT_FRAGMENT_WINDOW_DAYS);

    // Find other payments to this supplier in the same department within the window
    const recentPayments = await Event.find({
        supplier_id: event.supplier_id,
        department_id: event.department_id,
        event_type: EVENT_TYPES.PAYMENT_MADE,
        event_date: { $gte: windowStart, $lte: event.event_date }
    }).lean();

    if (recentPayments.length >= RISK_PARAMS.PAYMENT_FRAGMENT_MIN_COUNT) {
        const totalPayment = recentPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

        // Get department baseline to compare
        const baseline = await Baseline.getLatestBaseline('DEPARTMENT', event.department_id);
        const typicalContract = baseline?.contract_avg || 0;

        // Check if fragmented payments exceed typical contract value
        if (typicalContract > 0 && totalPayment > typicalContract) {
            return createFlag(
                'PAYMENT_FRAGMENTATION',
                SEVERITY.MEDIUM,
                `${recentPayments.length} payments totaling ${event.currency} ${totalPayment.toLocaleString()} made to supplier ${event.supplier_id} in department ${event.department_id} within ${RISK_PARAMS.PAYMENT_FRAGMENT_WINDOW_DAYS} days. This exceeds the typical contract value of ${event.currency} ${typicalContract.toLocaleString()}.`,
                {
                    payment_count: recentPayments.length,
                    total_amount: totalPayment,
                    typical_contract: typicalContract,
                    window_days: RISK_PARAMS.PAYMENT_FRAGMENT_WINDOW_DAYS,
                    supplier_id: event.supplier_id,
                    department_id: event.department_id
                }
            );
        }
    }

    return null;
};

/**
 * Rule 7: End-of-Period Spending Spike Detection
 * Flags significant spending increases near fiscal period end.
 * 
 * @param {Object} event - The current event
 * @returns {Promise<Object|null>}
 */
const checkEndOfPeriodSpike = async (event) => {
    if (event.event_type !== EVENT_TYPES.AWARD_GRANTED || event.contract_amount === null) {
        return null;
    }

    // Parse fiscal period to determine if we're near the end
    if (!event.fiscal_period) return null;

    const [year, quarter] = event.fiscal_period.split('-Q');
    const quarterNum = parseInt(quarter, 10);

    // Calculate period end date
    const endMonth = quarterNum * 3;
    const periodEnd = new Date(parseInt(year, 10), endMonth, 0);

    // Check if event is within END_OF_PERIOD_DAYS of period end
    const eventDate = new Date(event.event_date);
    const daysFromEnd = Math.ceil((periodEnd - eventDate) / (1000 * 60 * 60 * 24));

    if (daysFromEnd > RISK_PARAMS.END_OF_PERIOD_DAYS || daysFromEnd < 0) {
        return null;
    }

    // Get period baseline
    const baseline = await Baseline.getLatestBaseline('PERIOD', event.fiscal_period);

    if (!baseline || !baseline.is_reliable || baseline.daily_spending_avg === 0) {
        return null;
    }

    // Get recent spending in end-of-period window
    const windowStart = new Date(periodEnd);
    windowStart.setDate(periodEnd.getDate() - RISK_PARAMS.END_OF_PERIOD_DAYS);

    const endPeriodEvents = await Event.find({
        department_id: event.department_id,
        event_type: EVENT_TYPES.AWARD_GRANTED,
        event_date: { $gte: windowStart, $lte: periodEnd },
        fiscal_period: event.fiscal_period
    }).lean();

    const endPeriodSpending = endPeriodEvents.reduce((sum, e) => sum + (e.contract_amount || 0), 0);
    const expectedSpending = baseline.daily_spending_avg * RISK_PARAMS.END_OF_PERIOD_DAYS;
    const spikeMultiplier = expectedSpending > 0 ? endPeriodSpending / expectedSpending : 0;

    if (spikeMultiplier > RISK_PARAMS.END_OF_PERIOD_SPIKE_MULTIPLIER) {
        return createFlag(
            'END_OF_PERIOD_SPIKE',
            SEVERITY.LOW,
            `End-of-period spending in department ${event.department_id} (${event.currency} ${endPeriodSpending.toLocaleString()}) is ${spikeMultiplier.toFixed(1)}x the expected amount (${event.currency} ${expectedSpending.toLocaleString()}) for the last ${RISK_PARAMS.END_OF_PERIOD_DAYS} days of ${event.fiscal_period}.`,
            {
                department_id: event.department_id,
                fiscal_period: event.fiscal_period,
                end_period_spending: endPeriodSpending,
                expected_spending: expectedSpending,
                spike_multiplier: spikeMultiplier,
                threshold_multiplier: RISK_PARAMS.END_OF_PERIOD_SPIKE_MULTIPLIER,
                window_days: RISK_PARAMS.END_OF_PERIOD_DAYS
            }
        );
    }

    return null;
};

/**
 * Run all risk checks on an event
 * @param {Object} event - The event to analyze
 * @returns {Promise<Object>}
 */
const analyzeEvent = async (event) => {
    const flags = [];

    // Run all risk checks
    const checks = await Promise.all([
        checkSupplierDominance(event),
        Promise.resolve(checkLowCompetition(event)), // Synchronous, wrap in Promise
        checkAmountDeviation(event),
        checkSupplierPriceInflation(event),
        checkRapidSequentialAwards(event),
        checkPaymentFragmentation(event),
        checkEndOfPeriodSpike(event)
    ]);

    // Collect non-null flags
    for (const flag of checks) {
        if (flag) {
            flags.push(flag);
        }
    }

    // Calculate risk score
    const riskScore = flags.reduce((sum, flag) => sum + flag.points, 0);

    // Determine risk level
    let riskLevel;
    if (riskScore <= RISK_THRESHOLDS.LOW_MAX) {
        riskLevel = 'LOW';
    } else if (riskScore <= RISK_THRESHOLDS.MEDIUM_MAX) {
        riskLevel = 'MEDIUM';
    } else {
        riskLevel = 'HIGH';
    }

    return {
        event_id: event.event_id,
        tender_id: event.tender_id,
        flags,
        risk_score: riskScore,
        risk_level: riskLevel,
        analyzed_at: new Date().toISOString(),
        disclaimer: 'This analysis does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
    };
};

/**
 * Analyze all events for a tender
 * @param {string} tenderId 
 * @returns {Promise<Object>}
 */
const analyzeTender = async (tenderId) => {
    const events = await Event.getTenderLifecycle(tenderId);

    if (events.length === 0) {
        return {
            tender_id: tenderId,
            events_analyzed: 0,
            flags: [],
            risk_score: 0,
            risk_level: 'LOW',
            disclaimer: 'This analysis does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
        };
    }

    const allFlags = [];

    for (const event of events) {
        const analysis = await analyzeEvent(event);
        allFlags.push(...analysis.flags);
    }

    // Deduplicate similar flags
    const uniqueFlags = [];
    const seenTypes = new Set();
    for (const flag of allFlags) {
        const key = `${flag.risk_type}-${JSON.stringify(flag.details)}`;
        if (!seenTypes.has(key)) {
            seenTypes.add(key);
            uniqueFlags.push(flag);
        }
    }

    const riskScore = uniqueFlags.reduce((sum, flag) => sum + flag.points, 0);

    let riskLevel;
    if (riskScore <= RISK_THRESHOLDS.LOW_MAX) {
        riskLevel = 'LOW';
    } else if (riskScore <= RISK_THRESHOLDS.MEDIUM_MAX) {
        riskLevel = 'MEDIUM';
    } else {
        riskLevel = 'HIGH';
    }

    return {
        tender_id: tenderId,
        events_analyzed: events.length,
        flags: uniqueFlags,
        risk_score: riskScore,
        risk_level: riskLevel,
        analyzed_at: new Date().toISOString(),
        disclaimer: 'This analysis does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
    };
};

/**
 * Get risk summary for a department
 * @param {string} departmentId 
 * @returns {Promise<Object>}
 */
const analyzeDepartment = async (departmentId) => {
    const windowStart = new Date();
    windowStart.setMonth(windowStart.getMonth() - 12);

    const events = await Event.find({
        department_id: departmentId,
        event_date: { $gte: windowStart }
    }).sort({ event_date: 1 }).lean();

    const baseline = await Baseline.getLatestBaseline('DEPARTMENT', departmentId);

    // Analyze recent events and collect flags
    const allFlags = [];
    for (const event of events) {
        const analysis = await analyzeEvent(event);
        allFlags.push(...analysis.flags);
    }

    // Group flags by type
    const flagsByType = {};
    for (const flag of allFlags) {
        if (!flagsByType[flag.risk_type]) {
            flagsByType[flag.risk_type] = [];
        }
        flagsByType[flag.risk_type].push(flag);
    }

    const totalScore = allFlags.reduce((sum, flag) => sum + flag.points, 0);

    return {
        department_id: departmentId,
        window_months: 12,
        events_analyzed: events.length,
        baseline_stats: baseline ? {
            contract_avg: baseline.contract_avg,
            contract_total: baseline.contract_total,
            contract_count: baseline.contract_count,
            supplier_count: baseline.supplier_count
        } : null,
        flags_by_type: Object.entries(flagsByType).map(([type, flags]) => ({
            risk_type: type,
            count: flags.length,
            total_points: flags.reduce((sum, f) => sum + f.points, 0)
        })),
        total_flags: allFlags.length,
        total_risk_points: totalScore,
        analyzed_at: new Date().toISOString(),
        disclaimer: 'This analysis does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
    };
};

/**
 * Get risk history for a supplier
 * @param {string} supplierId 
 * @returns {Promise<Object>}
 */
const analyzeSupplier = async (supplierId) => {
    const windowStart = new Date();
    windowStart.setMonth(windowStart.getMonth() - 12);

    const events = await Event.find({
        supplier_id: supplierId,
        event_date: { $gte: windowStart }
    }).sort({ event_date: 1 }).lean();

    const baseline = await Baseline.getLatestBaseline('SUPPLIER', supplierId);

    // Analyze events
    const allFlags = [];
    for (const event of events) {
        const analysis = await analyzeEvent(event);
        allFlags.push(...analysis.flags);
    }

    // Group flags by type
    const flagsByType = {};
    for (const flag of allFlags) {
        if (!flagsByType[flag.risk_type]) {
            flagsByType[flag.risk_type] = [];
        }
        flagsByType[flag.risk_type].push(flag);
    }

    const totalScore = allFlags.reduce((sum, flag) => sum + flag.points, 0);

    // Get departments this supplier works with
    const departments = [...new Set(events.map(e => e.department_id))];

    return {
        supplier_id: supplierId,
        window_months: 12,
        events_analyzed: events.length,
        departments: departments,
        baseline_stats: baseline ? {
            contract_avg: baseline.contract_avg,
            contract_total: baseline.contract_total,
            contract_count: baseline.contract_count,
            win_rate: baseline.win_rate
        } : null,
        flags_by_type: Object.entries(flagsByType).map(([type, flags]) => ({
            risk_type: type,
            count: flags.length,
            total_points: flags.reduce((sum, f) => sum + f.points, 0)
        })),
        total_flags: allFlags.length,
        total_risk_points: totalScore,
        analyzed_at: new Date().toISOString(),
        disclaimer: 'This analysis does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
    };
};

module.exports = {
    analyzeEvent,
    analyzeTender,
    analyzeDepartment,
    analyzeSupplier,
    // Export individual checks for testing
    checkSupplierDominance,
    checkLowCompetition,
    checkAmountDeviation,
    checkSupplierPriceInflation,
    checkRapidSequentialAwards,
    checkPaymentFragmentation,
    checkEndOfPeriodSpike,
    createFlag
};
