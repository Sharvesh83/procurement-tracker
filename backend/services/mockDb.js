/**
 * Mock Database Service
 * 
 * Provides in-memory data for testing when MongoDB is unavailable.
 * Enabled via MOCK_DB=true environment variable.
 */

const crypto = require('crypto');
const { EVENT_TYPES, ROLES, RISK } = require('../config/constants');

// In-memory storage
const mockData = {
    users: [
        {
            _id: 'user-officer-001',
            username: 'officer1',
            password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // Officer123!
            role: ROLES.PROCUREMENT_OFFICER,
            fullName: 'Rajesh Kumar',
            email: 'officer1@gov.in',
            departmentId: 'DEPT-PUBLIC-WORKS',
            isActive: true
        },
        {
            _id: 'user-auditor-001',
            username: 'auditor1',
            password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // Auditor123!
            role: ROLES.AUDITOR,
            fullName: 'Anand Mehta',
            email: 'auditor1@gov.in',
            isActive: true
        }
    ],
    events: [],
    baselines: []
};

// Generate mock events
function generateMockEvents() {
    const departments = ['DEPT-PUBLIC-WORKS', 'DEPT-HEALTH', 'DEPT-EDUCATION', 'DEPT-TRANSPORT'];
    const suppliers = ['SUP-ALPHA-001', 'SUP-BETA-002', 'SUP-GAMMA-003', 'SUP-DELTA-004', 'SUP-EPSILON-005'];
    const events = [];
    let sequenceNumber = 1;
    let previousHash = null;

    // Generate 10 tenders with full lifecycle
    for (let t = 1; t <= 10; t++) {
        const tenderId = `TND-2024-${String(t).padStart(4, '0')}`;
        const department = departments[t % departments.length];
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - (30 - t * 3));

        // TENDER_CREATED
        const createEvent = createMockEvent({
            tenderId,
            department,
            eventType: EVENT_TYPES.TENDER_CREATED,
            date: new Date(baseDate),
            sequenceNumber: sequenceNumber++,
            previousHash
        });
        events.push(createEvent);
        previousHash = createEvent.event_hash;

        // BID_SUBMITTED (2-5 bids)
        const bidCount = 2 + (t % 4);
        for (let b = 0; b < bidCount; b++) {
            const bidDate = new Date(baseDate);
            bidDate.setDate(bidDate.getDate() + 3 + b);
            const bidEvent = createMockEvent({
                tenderId,
                department,
                eventType: EVENT_TYPES.BID_SUBMITTED,
                supplier: suppliers[(t + b) % suppliers.length],
                date: bidDate,
                bidCount: b + 1,
                sequenceNumber: sequenceNumber++,
                previousHash
            });
            events.push(bidEvent);
            previousHash = bidEvent.event_hash;
        }

        // AWARD_GRANTED
        const awardDate = new Date(baseDate);
        awardDate.setDate(awardDate.getDate() + 10);
        const winningSupplier = suppliers[t % suppliers.length];
        const contractAmount = 500000 + (t * 150000) + Math.floor(Math.random() * 100000);

        const awardEvent = createMockEvent({
            tenderId,
            department,
            eventType: EVENT_TYPES.AWARD_GRANTED,
            supplier: winningSupplier,
            date: awardDate,
            bidCount,
            awardRank: 1,
            contractAmount,
            sequenceNumber: sequenceNumber++,
            previousHash
        });
        events.push(awardEvent);
        previousHash = awardEvent.event_hash;

        // PAYMENT_MADE (1-2 payments)
        const paymentCount = 1 + (t % 2);
        let totalPaid = 0;
        for (let p = 0; p < paymentCount; p++) {
            const paymentDate = new Date(awardDate);
            paymentDate.setDate(paymentDate.getDate() + 15 + (p * 10));
            const paymentAmount = p === paymentCount - 1
                ? contractAmount - totalPaid
                : Math.floor(contractAmount * 0.5);
            totalPaid += paymentAmount;

            const paymentEvent = createMockEvent({
                tenderId,
                department,
                eventType: EVENT_TYPES.PAYMENT_MADE,
                supplier: winningSupplier,
                date: paymentDate,
                paymentAmount,
                sequenceNumber: sequenceNumber++,
                previousHash
            });
            events.push(paymentEvent);
            previousHash = paymentEvent.event_hash;
        }
    }

    return events;
}

function createMockEvent(params) {
    const eventId = `EVT-${Date.now()}-${params.sequenceNumber}`;
    const fiscalPeriod = getFiscalPeriod(params.date);

    const eventData = {
        event_id: eventId,
        tender_id: params.tenderId,
        event_type: params.eventType,
        department_id: params.department,
        supplier_id: params.supplier || null,
        bid_count: params.bidCount || null,
        award_rank: params.awardRank || null,
        contract_amount: params.contractAmount || null,
        payment_amount: params.paymentAmount || null,
        currency: 'INR',
        event_date: params.date,
        fiscal_period: fiscalPeriod,
        entered_by: 'system-mock',
        recorded_at: new Date(),
        previous_event_hash: params.previousHash,
        sequence_number: params.sequenceNumber
    };

    // Compute hash
    const canonical = JSON.stringify({
        ...eventData,
        event_date: eventData.event_date.toISOString()
    });
    eventData.event_hash = crypto
        .createHash('sha256')
        .update(canonical + (params.previousHash || 'GENESIS'))
        .digest('hex');

    return eventData;
}

function getFiscalPeriod(date) {
    const month = date.getMonth();
    const year = date.getFullYear();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
}

// Initialize mock data
mockData.events = generateMockEvents();

// Mock Model Methods
const MockUser = {
    findOne: async (query) => {
        if (query.username) {
            return mockData.users.find(u => u.username === query.username);
        }
        if (query._id) {
            return mockData.users.find(u => u._id === query._id);
        }
        return null;
    },
    findById: async (id) => mockData.users.find(u => u._id === id),
    create: async (userData) => {
        const user = { _id: `user-${Date.now()}`, ...userData };
        mockData.users.push(user);
        return user;
    }
};

const MockEvent = {
    find: (query = {}) => ({
        sort: (sortOpts) => ({
            limit: (n) => ({
                lean: async () => filterEvents(query).slice(0, n),
                skip: (s) => ({
                    lean: async () => filterEvents(query).slice(s, s + n)
                })
            }),
            lean: async () => filterEvents(query)
        }),
        lean: async () => filterEvents(query)
    }),
    findOne: (query = {}) => ({
        sort: (sortOpts) => ({
            limit: () => filterEvents(query)[0] || null
        })
    }),
    countDocuments: async (query = {}) => filterEvents(query).length,
    distinct: async (field, query = {}) => {
        const events = filterEvents(query);
        const values = [...new Set(events.map(e => e[field]).filter(v => v !== null))];
        return values;
    },
    aggregate: async (pipeline) => {
        // Simple aggregation support
        let events = mockData.events;

        for (const stage of pipeline) {
            if (stage.$match) {
                events = events.filter(e => matchQuery(e, stage.$match));
            }
            if (stage.$group) {
                return aggregateGroup(events, stage.$group);
            }
        }
        return events;
    },
    getLastEvent: async () => {
        if (mockData.events.length === 0) return null;
        return mockData.events[mockData.events.length - 1];
    },
    getTenderLifecycle: async (tenderId) => {
        return mockData.events.filter(e => e.tender_id === tenderId)
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    }
};

function filterEvents(query) {
    return mockData.events.filter(e => matchQuery(e, query));
}

function matchQuery(event, query) {
    for (const [key, value] of Object.entries(query)) {
        if (key === '$ne') continue;
        if (typeof value === 'object' && value !== null) {
            if (value.$gte && new Date(event[key]) < new Date(value.$gte)) return false;
            if (value.$lte && new Date(event[key]) > new Date(value.$lte)) return false;
            if (value.$ne && event[key] === value.$ne) return false;
        } else if (event[key] !== value) {
            return false;
        }
    }
    return true;
}

function aggregateGroup(events, groupSpec) {
    const groups = {};

    for (const event of events) {
        const groupKey = groupSpec._id === null ? 'all' : event[groupSpec._id.replace('$', '')];
        if (!groups[groupKey]) {
            groups[groupKey] = { _id: groupKey };
            for (const [field, op] of Object.entries(groupSpec)) {
                if (field === '_id') continue;
                if (op.$sum) groups[groupKey][field] = 0;
                if (op.$avg) groups[groupKey][field + '_sum'] = 0;
                if (op.$avg) groups[groupKey][field + '_count'] = 0;
                if (op.$addToSet) groups[groupKey][field] = new Set();
            }
        }

        for (const [field, op] of Object.entries(groupSpec)) {
            if (field === '_id') continue;
            if (op.$sum === 1) groups[groupKey][field]++;
            if (typeof op.$sum === 'string') {
                groups[groupKey][field] += event[op.$sum.replace('$', '')] || 0;
            }
            if (op.$avg) {
                groups[groupKey][field + '_sum'] += event[op.$avg.replace('$', '')] || 0;
                groups[groupKey][field + '_count']++;
            }
            if (op.$addToSet) {
                groups[groupKey][field].add(event[op.$addToSet.replace('$', '')]);
            }
        }
    }

    // Convert Sets to arrays and calculate averages
    return Object.values(groups).map(g => {
        const result = { ...g };
        for (const key of Object.keys(g)) {
            if (g[key] instanceof Set) {
                result[key] = [...g[key]];
            }
            if (key.endsWith('_sum')) {
                const baseKey = key.replace('_sum', '');
                result[baseKey] = g[key] / (g[baseKey + '_count'] || 1);
                delete result[key];
                delete result[baseKey + '_count'];
            }
        }
        return result;
    });
}

const MockBaseline = {
    findOne: async () => null,
    getLatestBaseline: async () => null,
    create: async (data) => data
};

module.exports = {
    MockUser,
    MockEvent,
    MockBaseline,
    mockData,
    isMockMode: () => process.env.MOCK_DB === 'true'
};
