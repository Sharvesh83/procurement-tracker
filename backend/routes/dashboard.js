/**
 * Dashboard Routes
 * 
 * Public and authenticated dashboard data endpoints.
 * All endpoints are read-only.
 */

const express = require('express');
const { auth, optionalAuth } = require('../middleware/auth');
const { anyAuthenticatedUser } = require('../middleware/roleGuard');
const Event = require('../models/Event');
const Baseline = require('../models/Baseline');
const riskEngine = require('../services/riskEngine');
const { EVENT_TYPES } = require('../config/constants');

const router = express.Router();

/**
 * GET /api/dashboard/overview
 * Get high-level procurement statistics
 * Requires authentication
 */
router.get('/overview', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        // Get date ranges
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        // Aggregate statistics
        const [
            totalEvents,
            recentEvents,
            totalTenders,
            totalDepartments,
            totalSuppliers,
            totalAwards,
            totalPayments
        ] = await Promise.all([
            Event.countDocuments(),
            Event.countDocuments({ event_date: { $gte: thirtyDaysAgo } }),
            Event.distinct('tender_id').then(ids => ids.length),
            Event.distinct('department_id').then(ids => ids.length),
            Event.distinct('supplier_id', { supplier_id: { $ne: null } }).then(ids => ids.length),
            Event.find({ event_type: EVENT_TYPES.AWARD_GRANTED }).lean(),
            Event.find({ event_type: EVENT_TYPES.PAYMENT_MADE }).lean()
        ]);

        // Calculate financial totals
        const totalContractValue = totalAwards.reduce((sum, a) => sum + (a.contract_amount || 0), 0);
        const totalPaymentValue = totalPayments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);

        // Get recent high-risk tenders
        const recentTenders = await Event.distinct('tender_id', {
            event_date: { $gte: thirtyDaysAgo }
        });

        let highRiskCount = 0;
        for (const tenderId of recentTenders.slice(0, 50)) { // Limit for performance
            const analysis = await riskEngine.analyzeTender(tenderId);
            if (analysis.risk_level === 'HIGH') {
                highRiskCount++;
            }
        }

        res.json({
            success: true,
            data: {
                events: {
                    total: totalEvents,
                    last_30_days: recentEvents
                },
                tenders: {
                    total: totalTenders,
                    high_risk_recent: highRiskCount
                },
                entities: {
                    departments: totalDepartments,
                    suppliers: totalSuppliers
                },
                financials: {
                    total_contract_value: totalContractValue,
                    total_payments: totalPaymentValue,
                    currency: 'INR'
                },
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch dashboard overview'
        });
    }
});

/**
 * GET /api/dashboard/public
 * Public transparency view - aggregated statistics only
 * No authentication required
 */
router.get('/public', async (req, res) => {
    try {
        const [
            totalTenders,
            totalDepartments,
            eventTypes
        ] = await Promise.all([
            Event.distinct('tender_id').then(ids => ids.length),
            Event.distinct('department_id').then(ids => ids.length),
            Event.aggregate([
                { $group: { _id: '$event_type', count: { $sum: 1 } } }
            ])
        ]);

        // Get awards for financial summary (aggregated only)
        const financialSummary = await Event.aggregate([
            { $match: { event_type: EVENT_TYPES.AWARD_GRANTED, contract_amount: { $ne: null } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$contract_amount' },
                    average: { $avg: '$contract_amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    total_tenders: totalTenders,
                    total_departments: totalDepartments,
                    events_by_type: eventTypes.reduce((acc, e) => {
                        acc[e._id] = e.count;
                        return acc;
                    }, {})
                },
                financials: financialSummary[0] ? {
                    total_contract_value: financialSummary[0].total,
                    average_contract_value: financialSummary[0].average,
                    total_contracts: financialSummary[0].count,
                    currency: 'INR',
                    note: 'Aggregated values only. Individual contract details require authentication.'
                } : null,
                disclaimer: 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.',
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Public dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch public dashboard'
        });
    }
});

/**
 * GET /api/dashboard/departments
 * List all departments with summary statistics
 */
router.get('/departments', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const departments = await Event.aggregate([
            {
                $group: {
                    _id: '$department_id',
                    event_count: { $sum: 1 },
                    tender_count: { $addToSet: '$tender_id' },
                    supplier_count: { $addToSet: '$supplier_id' }
                }
            },
            {
                $project: {
                    department_id: '$_id',
                    event_count: 1,
                    tender_count: { $size: '$tender_count' },
                    supplier_count: { $size: { $filter: { input: '$supplier_count', cond: { $ne: ['$$this', null] } } } }
                }
            },
            { $sort: { event_count: -1 } }
        ]);

        // Get baselines for each department
        const departmentsWithBaselines = await Promise.all(
            departments.map(async (dept) => {
                const baseline = await Baseline.getLatestBaseline('DEPARTMENT', dept._id);
                return {
                    department_id: dept._id,
                    event_count: dept.event_count,
                    tender_count: dept.tender_count,
                    supplier_count: dept.supplier_count,
                    baseline: baseline ? {
                        contract_avg: baseline.contract_avg,
                        contract_total: baseline.contract_total,
                        is_reliable: baseline.is_reliable
                    } : null
                };
            })
        );

        res.json({
            success: true,
            data: {
                departments: departmentsWithBaselines,
                count: departmentsWithBaselines.length
            }
        });

    } catch (error) {
        console.error('Departments list error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch departments'
        });
    }
});

/**
 * GET /api/dashboard/suppliers
 * List all suppliers with summary statistics
 */
router.get('/suppliers', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const suppliers = await Event.aggregate([
            { $match: { supplier_id: { $ne: null } } },
            {
                $group: {
                    _id: '$supplier_id',
                    event_count: { $sum: 1 },
                    department_count: { $addToSet: '$department_id' },
                    tender_count: { $addToSet: '$tender_id' }
                }
            },
            {
                $project: {
                    supplier_id: '$_id',
                    event_count: 1,
                    department_count: { $size: '$department_count' },
                    tender_count: { $size: '$tender_count' }
                }
            },
            { $sort: { event_count: -1 } }
        ]);

        // Get baselines for each supplier
        const suppliersWithBaselines = await Promise.all(
            suppliers.map(async (sup) => {
                const baseline = await Baseline.getLatestBaseline('SUPPLIER', sup._id);
                return {
                    supplier_id: sup._id,
                    event_count: sup.event_count,
                    department_count: sup.department_count,
                    tender_count: sup.tender_count,
                    baseline: baseline ? {
                        contract_avg: baseline.contract_avg,
                        contract_total: baseline.contract_total,
                        win_rate: baseline.win_rate,
                        is_reliable: baseline.is_reliable
                    } : null
                };
            })
        );

        res.json({
            success: true,
            data: {
                suppliers: suppliersWithBaselines,
                count: suppliersWithBaselines.length
            }
        });

    } catch (error) {
        console.error('Suppliers list error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch suppliers'
        });
    }
});

/**
 * GET /api/dashboard/high-risk-tenders
 * List tenders with high risk scores
 */
router.get('/high-risk-tenders', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

        // Get recent tenders
        const tenders = await Event.distinct('tender_id');

        const analyses = [];
        for (const tenderId of tenders) {
            const analysis = await riskEngine.analyzeTender(tenderId);
            if (analysis.risk_score > 0) {
                analyses.push(analysis);
            }
        }

        // Sort by risk score (highest first) and limit
        analyses.sort((a, b) => b.risk_score - a.risk_score);
        const topRisk = analyses.slice(0, limit);

        res.json({
            success: true,
            data: {
                tenders: topRisk,
                count: topRisk.length,
                total_analyzed: analyses.length
            }
        });

    } catch (error) {
        console.error('High risk tenders error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch high risk tenders'
        });
    }
});

module.exports = router;
