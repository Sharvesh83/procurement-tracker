/**
 * Ledger Verification Routes
 * 
 * Provides endpoints for verifying the integrity of the
 * tamper-evident procurement ledger.
 * 
 * Anyone with authentication can verify the ledger, ensuring
 * transparency and public accountability.
 */

const express = require('express');
const { auth, optionalAuth } = require('../middleware/auth');
const ledger = require('../services/ledger');

const router = express.Router();

/**
 * GET /api/verify-ledger
 * Verify the integrity of the entire event ledger
 * 
 * This endpoint:
 * 1. Fetches all events in sequence order
 * 2. Recomputes each event's hash
 * 3. Verifies the hash chain is unbroken
 * 4. Reports any detected tampering
 * 
 * Public access with optional authentication
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const result = await ledger.verifyLedgerIntegrity();

        // Log verification attempts for audit trail
        console.log(`Ledger verification by ${req.user?.username || 'anonymous'}: ${result.is_valid ? 'VALID' : 'INVALID'}`);

        res.json({
            success: true,
            message: result.is_valid
                ? 'Ledger integrity verified. No tampering detected.'
                : 'ALERT: Ledger integrity compromised. Tampering detected.',
            data: result,
            verified_at: new Date().toISOString(),
            verified_by: req.user?.username || 'anonymous'
        });

    } catch (error) {
        console.error('Ledger verification error:', error);
        res.status(500).json({
            success: false,
            error: 'VERIFICATION_FAILED',
            message: 'Failed to verify ledger integrity',
            details: error.message
        });
    }
});

/**
 * GET /api/verify-ledger/status
 * Quick check of ledger status (no full verification)
 * 
 * Returns basic ledger statistics without recomputing all hashes
 */
router.get('/status', optionalAuth, async (req, res) => {
    try {
        const stats = await ledger.getLedgerStats();

        res.json({
            success: true,
            data: {
                ...stats,
                status: 'operational',
                message: 'Use GET /api/verify-ledger for full integrity verification'
            }
        });

    } catch (error) {
        console.error('Ledger status error:', error);
        res.status(500).json({
            success: false,
            error: 'STATUS_FETCH_FAILED',
            message: 'Failed to fetch ledger status'
        });
    }
});

/**
 * GET /api/verify-ledger/event/:eventId
 * Verify a specific event's hash against its stored value
 */
router.get('/event/:eventId', auth, async (req, res) => {
    try {
        const Event = require('../models/Event');
        const { computeHash } = ledger;

        const event = await Event.findOne({ event_id: req.params.eventId }).lean();

        if (!event) {
            return res.status(404).json({
                success: false,
                error: 'EVENT_NOT_FOUND',
                message: `Event ${req.params.eventId} not found`
            });
        }

        // Recompute hash
        const canonicalEvent = Event.toCanonicalForm(event);
        const computedHash = computeHash(canonicalEvent, event.previous_event_hash);

        const isValid = computedHash === event.event_hash;

        res.json({
            success: true,
            data: {
                event_id: event.event_id,
                sequence_number: event.sequence_number,
                stored_hash: event.event_hash,
                computed_hash: computedHash,
                is_valid: isValid,
                message: isValid
                    ? 'Event hash verified. No tampering detected.'
                    : 'ALERT: Hash mismatch. Event may have been tampered with.'
            }
        });

    } catch (error) {
        console.error('Event verification error:', error);
        res.status(500).json({
            success: false,
            error: 'VERIFICATION_FAILED',
            message: 'Failed to verify event'
        });
    }
});

module.exports = router;
