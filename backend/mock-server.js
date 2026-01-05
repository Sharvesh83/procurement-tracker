/**
 * Mock Server
 * 
 * A standalone server with in-memory data that works without MongoDB.
 * Usage: node mock-server.js
 * 
 * This allows testing the frontend without any database setup.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { ROLES, EVENT_TYPES, RISK } = require('./config/constants');

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ============================================
// IN-MEMORY DATA
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'mock-secret-key';

// Pre-hashed passwords (both are "password123")
const HASHED_PASSWORD = '$2a$10$rqRm6/vGYJJxjXUwuLvbFOqaI1Y9SMwT.pSBGM8EbIl1N2b9e8VTy';

const users = [
    {
        _id: 'user-officer-001',
        username: 'officer1',
        password: HASHED_PASSWORD,
        role: ROLES.PROCUREMENT_OFFICER,
        fullName: 'Rajesh Kumar',
        email: 'officer1@gov.in',
        departmentId: 'DEPT-PUBLIC-WORKS',
        isActive: true
    },
    {
        _id: 'user-auditor-001',
        username: 'auditor1',
        password: HASHED_PASSWORD,
        role: ROLES.AUDITOR,
        fullName: 'Anand Mehta',
        email: 'auditor1@gov.in',
        isActive: true
    }
];

// Generate mock events
function generateEvents() {
    const departments = ['DEPT-PUBLIC-WORKS', 'DEPT-HEALTH', 'DEPT-EDUCATION', 'DEPT-TRANSPORT'];
    const suppliers = ['SUP-ALPHA-001', 'SUP-BETA-002', 'SUP-GAMMA-003', 'SUP-DELTA-004'];
    const events = [];
    let seq = 1;
    let prevHash = null;

    for (let t = 1; t <= 15; t++) {
        const tenderId = `TND-2024-${String(t).padStart(4, '0')}`;
        const dept = departments[t % departments.length];
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - (60 - t * 4));

        // TENDER_CREATED
        const e1 = makeEvent(tenderId, dept, null, EVENT_TYPES.TENDER_CREATED, baseDate, seq++, prevHash, {});
        events.push(e1);
        prevHash = e1.event_hash;

        // BID_SUBMITTED
        const bidCount = 2 + (t % 3);
        for (let b = 0; b < bidCount; b++) {
            const bidDate = new Date(baseDate);
            bidDate.setDate(bidDate.getDate() + 5 + b);
            const e = makeEvent(tenderId, dept, suppliers[(t + b) % suppliers.length], EVENT_TYPES.BID_SUBMITTED, bidDate, seq++, prevHash, { bid_count: b + 1 });
            events.push(e);
            prevHash = e.event_hash;
        }

        // AWARD_GRANTED
        const awardDate = new Date(baseDate);
        awardDate.setDate(awardDate.getDate() + 12);
        const winner = suppliers[t % suppliers.length];
        const amount = 500000 + t * 100000;
        const awardEvent = makeEvent(tenderId, dept, winner, EVENT_TYPES.AWARD_GRANTED, awardDate, seq++, prevHash, {
            bid_count: bidCount,
            award_rank: 1,
            contract_amount: amount
        });
        events.push(awardEvent);
        prevHash = awardEvent.event_hash;

        // PAYMENT_MADE
        const payDate = new Date(awardDate);
        payDate.setDate(payDate.getDate() + 20);
        const payEvent = makeEvent(tenderId, dept, winner, EVENT_TYPES.PAYMENT_MADE, payDate, seq++, prevHash, {
            payment_amount: amount
        });
        events.push(payEvent);
        prevHash = payEvent.event_hash;
    }

    return events;
}

function makeEvent(tenderId, dept, supplier, type, date, seq, prevHash, extras) {
    const eventId = `EVT-${seq}-${Date.now()}`;
    const q = Math.floor(date.getMonth() / 3) + 1;
    const fiscal = `${date.getFullYear()}-Q${q}`;

    const event = {
        event_id: eventId,
        tender_id: tenderId,
        event_type: type,
        department_id: dept,
        supplier_id: supplier,
        bid_count: extras.bid_count || null,
        award_rank: extras.award_rank || null,
        contract_amount: extras.contract_amount || null,
        payment_amount: extras.payment_amount || null,
        currency: 'INR',
        event_date: date.toISOString(),
        fiscal_period: fiscal,
        entered_by: 'system',
        recorded_at: new Date().toISOString(),
        previous_event_hash: prevHash,
        sequence_number: seq
    };

    const hash = crypto.createHash('sha256')
        .update(JSON.stringify(event) + (prevHash || 'GENESIS'))
        .digest('hex');
    event.event_hash = hash;

    return event;
}

const events = generateEvents();

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
        });
    }

    // For mock, accept any password or check against "password123"
    const validPassword = await bcrypt.compare(password, user.password) || password === 'Officer123!' || password === 'Auditor123!';

    if (!validPassword) {
        return res.status(401).json({
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password'
        });
    }

    const token = jwt.sign(
        { userId: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                email: user.email
            },
            token
        }
    });
});

app.post('/api/auth/register', (req, res) => {
    res.status(201).json({
        success: true,
        message: 'Registration disabled in mock mode'
    });
});

app.get('/api/auth/me', (req, res) => {
    const user = users[0];
    res.json({
        success: true,
        data: {
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                fullName: user.fullName
            }
        }
    });
});

// ============================================
// EVENTS ROUTES
// ============================================

app.get('/api/events', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const start = (page - 1) * limit;

    res.json({
        success: true,
        data: {
            events: events.slice(start, start + limit),
            pagination: {
                page,
                limit,
                total: events.length,
                pages: Math.ceil(events.length / limit)
            }
        }
    });
});

app.get('/api/events/recent', (req, res) => {
    const count = parseInt(req.query.count) || 10;
    res.json({
        success: true,
        data: {
            events: events.slice(-count).reverse()
        }
    });
});

app.get('/api/events/tender/:tenderId', (req, res) => {
    const tenderEvents = events.filter(e => e.tender_id === req.params.tenderId);
    res.json({
        success: true,
        data: { events: tenderEvents }
    });
});

app.get('/api/events/stats', (req, res) => {
    const lastEvent = events[events.length - 1];
    res.json({
        success: true,
        data: {
            total_events: events.length,
            last_sequence_number: lastEvent?.sequence_number || 0,
            last_event_date: lastEvent?.event_date,
            last_event_hash: lastEvent?.event_hash
        }
    });
});

app.post('/api/events', (req, res) => {
    res.status(201).json({
        success: true,
        message: 'Event submission disabled in mock mode',
        data: { event: req.body }
    });
});

// ============================================
// DASHBOARD ROUTES
// ============================================

app.get('/api/dashboard/public', (req, res) => {
    const tenders = [...new Set(events.map(e => e.tender_id))];
    const depts = [...new Set(events.map(e => e.department_id))];
    const awards = events.filter(e => e.event_type === EVENT_TYPES.AWARD_GRANTED);

    const eventsByType = {};
    events.forEach(e => {
        eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
    });

    res.json({
        success: true,
        data: {
            summary: {
                total_tenders: tenders.length,
                total_departments: depts.length,
                events_by_type: eventsByType
            },
            financials: {
                total_contract_value: awards.reduce((sum, a) => sum + (a.contract_amount || 0), 0),
                average_contract_value: awards.length > 0
                    ? awards.reduce((sum, a) => sum + (a.contract_amount || 0), 0) / awards.length
                    : 0,
                total_contracts: awards.length,
                currency: 'INR',
                note: 'Aggregated values only.'
            },
            disclaimer: 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.',
            generated_at: new Date().toISOString()
        }
    });
});

app.get('/api/dashboard/overview', (req, res) => {
    const tenders = [...new Set(events.map(e => e.tender_id))];
    const depts = [...new Set(events.map(e => e.department_id))];
    const suppliers = [...new Set(events.map(e => e.supplier_id).filter(Boolean))];
    const awards = events.filter(e => e.event_type === EVENT_TYPES.AWARD_GRANTED);
    const payments = events.filter(e => e.event_type === EVENT_TYPES.PAYMENT_MADE);

    res.json({
        success: true,
        data: {
            events: {
                total: events.length,
                last_30_days: events.filter(e => new Date(e.event_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
            },
            tenders: {
                total: tenders.length,
                high_risk_recent: 2
            },
            entities: {
                departments: depts.length,
                suppliers: suppliers.length
            },
            financials: {
                total_contract_value: awards.reduce((sum, a) => sum + (a.contract_amount || 0), 0),
                total_payments: payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0),
                currency: 'INR'
            },
            generated_at: new Date().toISOString()
        }
    });
});

app.get('/api/dashboard/departments', (req, res) => {
    const depts = [...new Set(events.map(e => e.department_id))];
    const result = depts.map(d => {
        const deptEvents = events.filter(e => e.department_id === d);
        const tenders = [...new Set(deptEvents.map(e => e.tender_id))];
        const suppliers = [...new Set(deptEvents.map(e => e.supplier_id).filter(Boolean))];
        const awards = deptEvents.filter(e => e.event_type === EVENT_TYPES.AWARD_GRANTED);
        const total = awards.reduce((sum, a) => sum + (a.contract_amount || 0), 0);

        return {
            department_id: d,
            event_count: deptEvents.length,
            tender_count: tenders.length,
            supplier_count: suppliers.length,
            baseline: {
                contract_avg: awards.length > 0 ? total / awards.length : 0,
                contract_total: total,
                is_reliable: awards.length >= 3
            }
        };
    });

    res.json({ success: true, data: { departments: result, count: result.length } });
});

app.get('/api/dashboard/suppliers', (req, res) => {
    const suppliers = [...new Set(events.map(e => e.supplier_id).filter(Boolean))];
    const result = suppliers.map(s => {
        const supEvents = events.filter(e => e.supplier_id === s);
        const depts = [...new Set(supEvents.map(e => e.department_id))];
        const tenders = [...new Set(supEvents.map(e => e.tender_id))];
        const awards = supEvents.filter(e => e.event_type === EVENT_TYPES.AWARD_GRANTED);
        const total = awards.reduce((sum, a) => sum + (a.contract_amount || 0), 0);

        return {
            supplier_id: s,
            event_count: supEvents.length,
            department_count: depts.length,
            tender_count: tenders.length,
            baseline: {
                contract_avg: awards.length > 0 ? total / awards.length : 0,
                contract_total: total,
                win_rate: 0.35,
                is_reliable: awards.length >= 2
            }
        };
    });

    res.json({ success: true, data: { suppliers: result, count: result.length } });
});

app.get('/api/dashboard/high-risk-tenders', (req, res) => {
    const tenders = [...new Set(events.map(e => e.tender_id))].slice(0, 5);
    const result = tenders.map((t, i) => ({
        tender_id: t,
        risk_score: 30 + i * 10,
        risk_level: i < 2 ? 'HIGH' : 'MEDIUM',
        flags: [
            { risk_type: 'LOW_COMPETITION', severity: 'MEDIUM', points: 20, explanation: 'Only 2 bids received.' }
        ]
    }));

    res.json({ success: true, data: { tenders: result, count: result.length, total_analyzed: tenders.length } });
});

// ============================================
// RISK ROUTES
// ============================================

app.get('/api/risk/tender/:tenderId', (req, res) => {
    const tenderEvents = events.filter(e => e.tender_id === req.params.tenderId);
    const award = tenderEvents.find(e => e.event_type === EVENT_TYPES.AWARD_GRANTED);

    res.json({
        success: true,
        data: {
            tender_id: req.params.tenderId,
            events_analyzed: tenderEvents.length,
            risk_score: 25,
            risk_level: 'MEDIUM',
            flags: award && award.bid_count <= 2 ? [
                {
                    risk_type: 'LOW_COMPETITION',
                    severity: 'MEDIUM',
                    points: 20,
                    explanation: `Only ${award.bid_count} bid(s) received. Low competition may limit value for money.`
                }
            ] : [],
            disclaimer: 'This analysis does NOT determine corruption. It highlights patterns for human review.'
        }
    });
});

app.get('/api/risk/department/:deptId', (req, res) => {
    res.json({
        success: true,
        data: {
            department_id: req.params.deptId,
            events_analyzed: 25,
            total_flags: 3,
            total_risk_points: 60,
            flags_by_type: [
                { risk_type: 'LOW_COMPETITION', count: 2 },
                { risk_type: 'SUPPLIER_DOMINANCE', count: 1 }
            ],
            disclaimer: 'This analysis does NOT determine corruption.'
        }
    });
});

app.get('/api/risk/supplier/:supplierId', (req, res) => {
    res.json({
        success: true,
        data: {
            supplier_id: req.params.supplierId,
            events_analyzed: 15,
            total_flags: 1,
            total_risk_points: 30,
            departments: ['DEPT-PUBLIC-WORKS'],
            flags_by_type: [
                { risk_type: 'RAPID_SEQUENTIAL_AWARDS', count: 1 }
            ],
            disclaimer: 'This analysis does NOT determine corruption.'
        }
    });
});

app.get('/api/risk/rules', (req, res) => {
    res.json({
        success: true,
        data: {
            disclaimer: 'This system does NOT determine corruption. It highlights abnormal patterns for review.',
            scoring: {
                low_points: RISK.SCORING.LOW,
                medium_points: RISK.SCORING.MEDIUM,
                high_points: RISK.SCORING.HIGH,
                interpretation: {
                    low: '0-20 points: Low risk - routine monitoring',
                    medium: '21-50 points: Medium risk - enhanced review recommended',
                    high: '51+ points: High risk - priority review required'
                }
            },
            rules: [
                {
                    id: 'SUPPLIER_DOMINANCE',
                    name: 'Supplier Dominance',
                    severity: 'HIGH',
                    points: 30,
                    description: 'A single supplier wins more than 60% of contracts in a department.',
                    logic: 'wins / total_awards > 0.6',
                    parameters: { threshold: 0.6, lookback_months: 12 }
                },
                {
                    id: 'LOW_COMPETITION',
                    name: 'Low Competition',
                    severity: 'MEDIUM',
                    points: 20,
                    description: 'Tender received 2 or fewer bids.',
                    logic: 'bid_count <= 2',
                    parameters: { min_bids: 2 }
                },
                {
                    id: 'AMOUNT_DEVIATION',
                    name: 'Amount Deviation',
                    severity: 'HIGH',
                    points: 30,
                    description: 'Contract amount exceeds department average by more than 2 standard deviations.',
                    logic: 'amount > mean + 2σ',
                    parameters: { std_dev_threshold: 2 }
                }
            ]
        }
    });
});

// ============================================
// LEDGER ROUTES
// ============================================

app.get('/api/verify-ledger', (req, res) => {
    res.json({
        success: true,
        data: {
            is_valid: true,
            total_events: events.length,
            verified_events: events.length,
            verification_time_ms: 45,
            message: 'Ledger integrity verified. No tampering detected.'
        }
    });
});

app.get('/api/verify-ledger/status', (req, res) => {
    const lastEvent = events[events.length - 1];
    res.json({
        success: true,
        data: {
            total_events: events.length,
            last_sequence: lastEvent?.sequence_number,
            last_hash: lastEvent?.event_hash,
            status: 'HEALTHY'
        }
    });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        mode: 'MOCK',
        timestamp: new Date().toISOString(),
        disclaimer: 'This is a MOCK server for testing. No real data is being used.'
    });
});

// Block dangerous methods
app.put('*', (req, res) => res.status(405).json({ error: 'Method not allowed' }));
app.patch('*', (req, res) => res.status(405).json({ error: 'Method not allowed' }));
app.delete('*', (req, res) => res.status(405).json({ error: 'Method not allowed' }));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found', path: req.path });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🧪 MOCK SERVER - No MongoDB Required                        ║
║   Running on port ${PORT}                                      ║
║                                                                ║
║   Demo credentials:                                            ║
║   - officer1 / Officer123!                                     ║
║   - auditor1 / Auditor123!                                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
});
