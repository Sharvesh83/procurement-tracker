/**
 * Risk Analysis Routes
 * 
 * API endpoints for accessing risk analysis results.
 * All endpoints are read-only.
 * 
 * IMPORTANT DISCLAIMER:
 * The risk analysis system does NOT determine corruption.
 * It highlights abnormal procurement patterns for human review.
 */

const express = require('express');
const { auth } = require('../middleware/auth');
const { anyAuthenticatedUser } = require('../middleware/roleGuard');
const { validateTenderId, validateDepartmentId, validateSupplierId } = require('../middleware/validation');
const riskEngine = require('../services/riskEngine');
const baselines = require('../services/baselines');
const { RISK_PARAMS, RISK_POINTS, RISK_THRESHOLDS } = require('../config/constants');

const router = express.Router();

/**
 * GET /api/risk/tender/:tenderId
 * Analyze all events for a specific tender
 */
router.get('/tender/:tenderId', auth, anyAuthenticatedUser, validateTenderId, async (req, res) => {
    try {
        const analysis = await riskEngine.analyzeTender(req.params.tenderId);

        res.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('Tender risk analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'ANALYSIS_FAILED',
            message: 'Failed to analyze tender risk'
        });
    }
});

/**
 * GET /api/risk/department/:departmentId
 * Get risk summary for a department
 */
router.get('/department/:departmentId', auth, anyAuthenticatedUser, validateDepartmentId, async (req, res) => {
    try {
        const analysis = await riskEngine.analyzeDepartment(req.params.departmentId);

        res.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('Department risk analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'ANALYSIS_FAILED',
            message: 'Failed to analyze department risk'
        });
    }
});

/**
 * GET /api/risk/supplier/:supplierId
 * Get risk history for a supplier
 */
router.get('/supplier/:supplierId', auth, anyAuthenticatedUser, validateSupplierId, async (req, res) => {
    try {
        const analysis = await riskEngine.analyzeSupplier(req.params.supplierId);

        res.json({
            success: true,
            data: analysis
        });

    } catch (error) {
        console.error('Supplier risk analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'ANALYSIS_FAILED',
            message: 'Failed to analyze supplier risk'
        });
    }
});

/**
 * GET /api/risk/rules
 * Get documentation of all risk detection rules
 * 
 * This endpoint provides transparency about how risks are detected
 */
router.get('/rules', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const rules = [
            {
                id: 'SUPPLIER_DOMINANCE',
                name: 'Supplier Dominance',
                description: 'Detects when a single supplier wins an unusually high percentage of contracts in a department.',
                severity: 'HIGH',
                points: RISK_POINTS.HIGH,
                parameters: {
                    threshold_percentage: RISK_PARAMS.SUPPLIER_DOMINANCE_THRESHOLD * 100,
                    window_months: RISK_PARAMS.SUPPLIER_DOMINANCE_WINDOW_MONTHS
                },
                logic: `Triggers when a supplier wins more than ${RISK_PARAMS.SUPPLIER_DOMINANCE_THRESHOLD * 100}% of contracts in a department over a rolling ${RISK_PARAMS.SUPPLIER_DOMINANCE_WINDOW_MONTHS}-month window.`
            },
            {
                id: 'LOW_COMPETITION',
                name: 'Low Competition',
                description: 'Flags contracts awarded with minimal competitive bidding.',
                severity: 'MEDIUM',
                points: RISK_POINTS.MEDIUM,
                parameters: {
                    max_bids: RISK_PARAMS.LOW_COMPETITION_MAX_BIDS
                },
                logic: `Triggers when a contract is awarded with ${RISK_PARAMS.LOW_COMPETITION_MAX_BIDS} or fewer bids.`
            },
            {
                id: 'AMOUNT_DEVIATION',
                name: 'Amount Deviation',
                description: 'Identifies contracts significantly above department historical averages.',
                severity: 'HIGH',
                points: RISK_POINTS.HIGH,
                parameters: {
                    sigma_threshold: RISK_PARAMS.AMOUNT_DEVIATION_SIGMA
                },
                logic: `Triggers when contract amount exceeds department mean plus ${RISK_PARAMS.AMOUNT_DEVIATION_SIGMA} standard deviations.`
            },
            {
                id: 'SUPPLIER_PRICE_INFLATION',
                name: 'Supplier Price Inflation',
                description: 'Detects when a supplier\'s contract is significantly above their historical average.',
                severity: 'MEDIUM',
                points: RISK_POINTS.MEDIUM,
                parameters: {
                    threshold_percentage: RISK_PARAMS.PRICE_INFLATION_THRESHOLD * 100
                },
                logic: `Triggers when contract amount is more than ${RISK_PARAMS.PRICE_INFLATION_THRESHOLD * 100}% above the supplier's rolling average.`
            },
            {
                id: 'RAPID_SEQUENTIAL_AWARDS',
                name: 'Rapid Sequential Awards',
                description: 'Flags when a supplier receives multiple contracts in quick succession.',
                severity: 'HIGH',
                points: RISK_POINTS.HIGH,
                parameters: {
                    min_contracts: RISK_PARAMS.RAPID_AWARD_MIN_COUNT,
                    window_days: RISK_PARAMS.RAPID_AWARD_WINDOW_DAYS
                },
                logic: `Triggers when a supplier receives ${RISK_PARAMS.RAPID_AWARD_MIN_COUNT} or more contracts in the same department within ${RISK_PARAMS.RAPID_AWARD_WINDOW_DAYS} days.`
            },
            {
                id: 'PAYMENT_FRAGMENTATION',
                name: 'Payment Fragmentation',
                description: 'Identifies unusual patterns of multiple payments that may indicate threshold circumvention.',
                severity: 'MEDIUM',
                points: RISK_POINTS.MEDIUM,
                parameters: {
                    min_payments: RISK_PARAMS.PAYMENT_FRAGMENT_MIN_COUNT,
                    window_days: RISK_PARAMS.PAYMENT_FRAGMENT_WINDOW_DAYS
                },
                logic: `Triggers when ${RISK_PARAMS.PAYMENT_FRAGMENT_MIN_COUNT} or more payments are made within ${RISK_PARAMS.PAYMENT_FRAGMENT_WINDOW_DAYS} days and their sum exceeds typical contract value.`
            },
            {
                id: 'END_OF_PERIOD_SPIKE',
                name: 'End-of-Period Spending Spike',
                description: 'Detects unusual spending increases near fiscal period end.',
                severity: 'LOW',
                points: RISK_POINTS.LOW,
                parameters: {
                    window_days: RISK_PARAMS.END_OF_PERIOD_DAYS,
                    spike_multiplier: RISK_PARAMS.END_OF_PERIOD_SPIKE_MULTIPLIER
                },
                logic: `Triggers when spending in the last ${RISK_PARAMS.END_OF_PERIOD_DAYS} days of a fiscal period exceeds ${RISK_PARAMS.END_OF_PERIOD_SPIKE_MULTIPLIER}x the expected amount.`
            }
        ];

        res.json({
            success: true,
            data: {
                rules,
                scoring: {
                    low_points: RISK_POINTS.LOW,
                    medium_points: RISK_POINTS.MEDIUM,
                    high_points: RISK_POINTS.HIGH,
                    thresholds: {
                        low_max: RISK_THRESHOLDS.LOW_MAX,
                        medium_max: RISK_THRESHOLDS.MEDIUM_MAX
                    },
                    interpretation: {
                        low: `Score 0-${RISK_THRESHOLDS.LOW_MAX}: Low risk - Minimal review priority`,
                        medium: `Score ${RISK_THRESHOLDS.LOW_MAX + 1}-${RISK_THRESHOLDS.MEDIUM_MAX}: Medium risk - Should be reviewed`,
                        high: `Score ${RISK_THRESHOLDS.MEDIUM_MAX + 1}+: High risk - Priority review recommended`
                    }
                },
                disclaimer: 'These rules identify patterns for human review. They do NOT determine corruption or wrongdoing.'
            }
        });

    } catch (error) {
        console.error('Rules fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch risk rules'
        });
    }
});

/**
 * POST /api/risk/recompute-baselines
 * Trigger recomputation of all baselines
 * 
 * This is typically run on a schedule, but can be triggered manually
 */
router.post('/recompute-baselines', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const result = await baselines.recomputeAllBaselines();

        res.json({
            success: true,
            message: 'Baselines recomputed successfully',
            data: result
        });

    } catch (error) {
        console.error('Baseline recomputation error:', error);
        res.status(500).json({
            success: false,
            error: 'RECOMPUTATION_FAILED',
            message: 'Failed to recompute baselines'
        });
    }
});

/**
 * GET /api/risk/baselines/:type/:entityId
 * Get baseline for a specific entity
 */
router.get('/baselines/:type/:entityId', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const validTypes = ['DEPARTMENT', 'SUPPLIER', 'PERIOD'];
        const type = req.params.type.toUpperCase();

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_TYPE',
                message: `Type must be one of: ${validTypes.join(', ')}`
            });
        }

        const baseline = await baselines.getBaseline(type, req.params.entityId);

        if (!baseline) {
            return res.status(404).json({
                success: false,
                error: 'BASELINE_NOT_FOUND',
                message: `No baseline found for ${type} ${req.params.entityId}`
            });
        }

        res.json({
            success: true,
            data: baseline
        });

    } catch (error) {
        console.error('Baseline fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch baseline'
        });
    }
});

module.exports = router;
