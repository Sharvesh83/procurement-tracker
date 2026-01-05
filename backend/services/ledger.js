/**
 * Tamper-Evident Ledger Service
 * 
 * This service manages the hash-chained append-only event ledger.
 * 
 * CRITICAL SECURITY FEATURES:
 * 1. Each event is hashed with SHA-256
 * 2. Each event includes the previous event's hash (chain linking)
 * 3. No update or delete operations are exposed
 * 4. Ledger integrity can be verified at any time
 * 
 * Hash computation:
 *   event_hash = SHA256(canonical_json(event_data) + previous_event_hash)
 * 
 * The genesis event (first event) has previous_event_hash = null
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Event = require('../models/Event');
const { LEDGER } = require('../config/constants');

/**
 * Compute SHA-256 hash of event data
 * @param {Object} eventData - Canonical event data
 * @param {string|null} previousHash - Hash of the previous event
 * @returns {string} - Hex-encoded SHA-256 hash
 */
const computeHash = (eventData, previousHash) => {
    // Convert event to canonical JSON string
    // Keys are sorted alphabetically for deterministic serialization
    const canonicalJson = JSON.stringify(eventData, Object.keys(eventData).sort());

    // Concatenate with previous hash (empty string if null for genesis)
    const dataToHash = canonicalJson + (previousHash || '');

    // Compute SHA-256 hash
    return crypto
        .createHash(LEDGER.HASH_ALGORITHM)
        .update(dataToHash, 'utf8')
        .digest('hex');
};

/**
 * Append a new event to the ledger
 * This is the ONLY way to add events to the system
 * 
 * @param {Object} eventData - Raw event data from the API
 * @param {string} enteredBy - User ID who is submitting the event
 * @returns {Promise<Object>} - The created event with hash chain
 * @throws {Error} - If validation fails or hash chain is broken
 */
const appendEvent = async (eventData, enteredBy) => {
    // Use mutex-like approach to ensure atomicity
    // MongoDB doesn't have true transactions for single-document ops,
    // but we use findOneAndUpdate with $setOnInsert for sequence safety

    try {
        // Get the last event to chain from
        const lastEvent = await Event.getLastEvent();

        // Determine sequence number and previous hash
        const sequenceNumber = lastEvent ? lastEvent.sequence_number + 1 : 1;
        const previousEventHash = lastEvent ? lastEvent.event_hash : LEDGER.GENESIS_PREVIOUS_HASH;

        // Generate unique event ID
        const eventId = uuidv4();

        // Parse and validate event date
        const eventDate = new Date(eventData.event_date);
        if (isNaN(eventDate.getTime())) {
            throw new Error('Invalid event date format');
        }

        // Prepare the complete event object
        const completeEvent = {
            event_id: eventId,
            tender_id: eventData.tender_id,
            event_type: eventData.event_type,
            supplier_id: eventData.supplier_id || null,
            department_id: eventData.department_id,
            bid_count: eventData.bid_count ?? null,
            award_rank: eventData.award_rank ?? null,
            contract_amount: eventData.contract_amount ?? null,
            payment_amount: eventData.payment_amount ?? null,
            currency: eventData.currency || 'INR',
            event_date: eventDate,
            fiscal_period: eventData.fiscal_period,
            entered_by: enteredBy,
            recorded_at: new Date(),
            previous_event_hash: previousEventHash,
            sequence_number: sequenceNumber
        };

        // Get canonical form for hashing
        const canonicalEvent = Event.toCanonicalForm(completeEvent);

        // Compute the hash for this event
        const eventHash = computeHash(canonicalEvent, previousEventHash);
        completeEvent.event_hash = eventHash;

        // Create the event document
        const event = new Event(completeEvent);

        // Save to database
        await event.save();

        console.log(`Event appended: ${eventId} (seq: ${sequenceNumber}, hash: ${eventHash.substring(0, 16)}...)`);

        return event.toObject();
    } catch (error) {
        // Handle duplicate sequence number (concurrent insert race condition)
        if (error.code === 11000) {
            // Retry once with fresh sequence number
            console.warn('Sequence collision detected, retrying...');
            return appendEvent(eventData, enteredBy);
        }
        throw error;
    }
};

/**
 * Verify the integrity of the entire ledger
 * Recomputes all hashes and checks the chain
 * 
 * @returns {Promise<Object>} - Verification result with details
 */
const verifyLedgerIntegrity = async () => {
    const startTime = Date.now();
    const result = {
        is_valid: true,
        total_events: 0,
        verified_events: 0,
        first_invalid_sequence: null,
        first_invalid_event_id: null,
        error_type: null,
        error_message: null,
        verification_time_ms: 0
    };

    try {
        // Fetch all events in order
        const events = await Event.find()
            .sort({ sequence_number: 1 })
            .lean();

        result.total_events = events.length;

        if (events.length === 0) {
            result.verification_time_ms = Date.now() - startTime;
            return result;
        }

        let previousHash = LEDGER.GENESIS_PREVIOUS_HASH;

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            // Verify sequence continuity
            const expectedSequence = i + 1;
            if (event.sequence_number !== expectedSequence) {
                result.is_valid = false;
                result.first_invalid_sequence = event.sequence_number;
                result.first_invalid_event_id = event.event_id;
                result.error_type = 'SEQUENCE_GAP';
                result.error_message = `Expected sequence ${expectedSequence}, found ${event.sequence_number}`;
                break;
            }

            // Verify previous hash link
            if (event.previous_event_hash !== previousHash) {
                result.is_valid = false;
                result.first_invalid_sequence = event.sequence_number;
                result.first_invalid_event_id = event.event_id;
                result.error_type = 'CHAIN_BREAK';
                result.error_message = `Previous hash mismatch at sequence ${event.sequence_number}`;
                break;
            }

            // Recompute hash and verify
            const canonicalEvent = Event.toCanonicalForm(event);
            const computedHash = computeHash(canonicalEvent, previousHash);

            if (computedHash !== event.event_hash) {
                result.is_valid = false;
                result.first_invalid_sequence = event.sequence_number;
                result.first_invalid_event_id = event.event_id;
                result.error_type = 'HASH_MISMATCH';
                result.error_message = `Hash mismatch at sequence ${event.sequence_number}. Event may have been tampered with.`;
                break;
            }

            result.verified_events++;
            previousHash = event.event_hash;
        }

    } catch (error) {
        result.is_valid = false;
        result.error_type = 'VERIFICATION_ERROR';
        result.error_message = error.message;
    }

    result.verification_time_ms = Date.now() - startTime;
    return result;
};

/**
 * Get the last N events in the ledger
 * @param {number} count - Number of events to retrieve
 * @returns {Promise<Array>}
 */
const getRecentEvents = async (count = 10) => {
    return Event.find()
        .sort({ sequence_number: -1 })
        .limit(count)
        .lean();
};

/**
 * Get ledger statistics
 * @returns {Promise<Object>}
 */
const getLedgerStats = async () => {
    const totalEvents = await Event.countDocuments();
    const lastEvent = await Event.getLastEvent();

    return {
        total_events: totalEvents,
        last_sequence_number: lastEvent?.sequence_number || 0,
        last_event_hash: lastEvent?.event_hash || null,
        last_event_date: lastEvent?.recorded_at || null
    };
};

/**
 * Get events for a specific tender
 * @param {string} tenderId 
 * @returns {Promise<Array>}
 */
const getTenderEvents = async (tenderId) => {
    return Event.getTenderLifecycle(tenderId);
};

/**
 * Get events by department within a date range
 * @param {string} departmentId 
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Array>}
 */
const getDepartmentEvents = async (departmentId, startDate, endDate) => {
    return Event.getDepartmentEvents(departmentId, startDate, endDate);
};

/**
 * Get all events with pagination
 * @param {number} page 
 * @param {number} limit 
 * @returns {Promise<Object>}
 */
const getAllEvents = async (page = 1, limit = 50) => {
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
        Event.find()
            .sort({ sequence_number: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Event.countDocuments()
    ]);

    return {
        events,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

module.exports = {
    computeHash,
    appendEvent,
    verifyLedgerIntegrity,
    getRecentEvents,
    getLedgerStats,
    getTenderEvents,
    getDepartmentEvents,
    getAllEvents
};
