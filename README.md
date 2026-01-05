# Procurement Monitoring System

A **corruption-resistant, tamper-evident public procurement monitoring system** designed for transparency and accountability.

> ⚠️ **IMPORTANT**: This system does NOT determine corruption. It highlights abnormal procurement patterns for human review only.

## Features

- 📊 **Observational Only** - Monitors without interfering with procurement decisions
- 🔐 **Tamper-Evident Ledger** - SHA-256 hash-chained append-only event storage
- 🎯 **Deterministic Rules** - 7 rule-based risk detection mechanisms (no AI)
- 📋 **Explainable Flags** - Every alert includes clear human-readable explanation
- 👤 **Role-Based Access** - Procurement Officers (submit) vs Auditors (view-only)
- 📈 **Read-Only Dashboard** - No edit/delete capabilities by design

## Tech Stack

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Chart.js
- **Security**: JWT authentication, bcrypt password hashing
- **Integrity**: SHA-256 hash chaining

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6.0+ (running on localhost:27017)

### Backend
```bash
cd backend
npm install
npm run seed    # Generate demo data
npm run dev     # Start server on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Start on port 5173
```

### Demo Credentials
| Role | Username | Password |
|------|----------|----------|
| Procurement Officer | officer1 | Officer123! |
| Auditor | auditor1 | Auditor123! |

## Risk Detection Rules

| Rule | Severity | Trigger |
|------|----------|---------|
| Supplier Dominance | HIGH | >60% wins in department (12 months) |
| Low Competition | MEDIUM | ≤2 bids received |
| Amount Deviation | HIGH | Contract > mean + 2σ |
| Price Inflation | MEDIUM | >50% above supplier average |
| Rapid Awards | HIGH | ≥2 contracts in 14 days |
| Payment Fragmentation | MEDIUM | ≥3 payments in 7 days |
| End-of-Period Spike | LOW | 2x spending near fiscal end |

## API Endpoints

```
POST /api/auth/login          # Authenticate
POST /api/events              # Submit event (Officers only)
GET  /api/events              # List events
GET  /api/verify-ledger       # Verify integrity
GET  /api/risk/tender/:id     # Analyze tender
GET  /api/dashboard/public    # Public stats (no auth)
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  React Frontend │────▶│  Express Backend │────▶│   MongoDB   │
│  (Read-Only)    │◀────│  (Append-Only)   │◀────│  (Ledger)   │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Risk Engine       │
                    │   (7 Deterministic  │
                    │    Rules)           │
                    └─────────────────────┘
```

## Security Guarantees

1. **No updates or deletes** - Mongoose middleware blocks all modification operations
2. **Hash chain verification** - Each event links to previous via SHA-256
3. **Method blocking** - Server rejects PUT/PATCH/DELETE with 405
4. **Immutable schema** - All event fields marked as immutable

## License

ISC
