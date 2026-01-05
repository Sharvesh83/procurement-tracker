/**
 * Event Routes
 * 
 * API endpoints for procurement event submission and retrieval.
 * 
 * Access Control:
 * - POST /api/events: Procurement Officers only
 * - GET endpoints: All authenticated users
 * 
 * CRITICAL: No PUT, PATCH, or DELETE endpoints exist.
 * The ledger is append-only by design.
 */

const express = require('express');
const { auth } = require('../middleware/auth');
const { procurementOfficerOnly, blockLedgerModification, anyAuthenticatedUser } = require('../middleware/roleGuard');
const { validateEventSubmission, validateTenderId, validateDepartmentId, validatePagination } = require('../middleware/validation');
const ledger = require('../services/ledger');
const riskEngine = require('../services/riskEngine');

const router = express.Router();

// Apply ledger modification block to all routes
router.use(blockLedgerModification);

/**
 * POST /api/events
 * Submit a new procurement event
 * 
 * Requires: PROCUREMENT_OFFICER role
 * Body: Event data (see Event model for schema)
 */
router.post('/', auth, procurementOfficerOnly, validateEventSubmission, async (req, res) => {
    try {
        // Append event to the ledger
        const event = await ledger.appendEvent(req.body, req.userId);

        // Run risk analysis on the new event
        const riskAnalysis = await riskEngine.analyzeEvent(event);

        res.status(201).json({
            success: true,
            message: 'Event recorded successfully',
            data: {
                event,
                risk_analysis: riskAnalysis
            }
        });

    } catch (error) {
        console.error('Event submission error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'EVENT_SUBMISSION_FAILED',
            message: 'Failed to record event'
        });
    }
});

/**
 * GET /api/events
 * List all events with pagination
 * 
 * Query params: page (default 1), limit (default 50)
 */
router.get('/', auth, anyAuthenticatedUser, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;

        const result = await ledger.getAllEvents(page, limit);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Event list error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch events'
        });
    }
});

/**
 * GET /api/events/tender/:tenderId
 * Get all events for a specific tender (lifecycle view)
 */
router.get('/tender/:tenderId', auth, anyAuthenticatedUser, validateTenderId, async (req, res) => {
    try {
        const events = await ledger.getTenderEvents(req.params.tenderId);

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'TENDER_NOT_FOUND',
                message: `No events found for tender ${req.params.tenderId}`
            });
        }

        res.json({
            success: true,
            data: {
                tender_id: req.params.tenderId,
                events,
                event_count: events.length
            }
        });

    } catch (error) {
        console.error('Tender fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch tender events'
        });
    }
});

/**
 * GET /api/events/department/:departmentId
 * Get events for a department within a date range
 * 
 * Query params: startDate, endDate (ISO-8601)
 */
router.get('/department/:departmentId', auth, anyAuthenticatedUser, validateDepartmentId, async (req, res) => {
    try {
        // Default to last 12 months if no dates provided
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const startDate = req.query.startDate
            ? new Date(req.query.startDate)
            : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_DATE',
                message: 'Invalid date format. Use ISO-8601 format.'
            });
        }

        const events = await ledger.getDepartmentEvents(req.params.departmentId, startDate, endDate);

        res.json({
            success: true,
            data: {
                department_id: req.params.departmentId,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                events,
                event_count: events.length
            }
        });

    } catch (error) {
        console.error('Department events fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch department events'
        });
    }
});

/**
 * GET /api/events/recent
 * Get the most recent events
 * 
 * Query params: count (default 10, max 100)
 */
router.get('/recent', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const count = Math.min(parseInt(req.query.count, 10) || 10, 100);
        const events = await ledger.getRecentEvents(count);

        res.json({
            success: true,
            data: {
                events,
                count: events.length
            }
        });

    } catch (error) {
        console.error('Recent events fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch recent events'
        });
    }
});

/**
 * GET /api/events/stats
 * Get ledger statistics
 */
router.get('/stats', auth, anyAuthenticatedUser, async (req, res) => {
    try {
        const stats = await ledger.getLedgerStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_FAILED',
            message: 'Failed to fetch ledger statistics'
        });
    }
});

module.exports = router;
