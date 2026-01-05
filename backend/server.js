/**
 * Procurement Monitoring System - Main Server
 * 
 * A corruption-resistant, tamper-evident system for monitoring
 * public procurement activities.
 * 
 * CRITICAL DESIGN PRINCIPLES:
 * - Observational only: Does NOT interfere with procurement decisions
 * - Deterministic: No randomness or probabilistic AI
 * - Explainable: Every flag includes clear human-readable explanation
 * - Auditable: Append-only ledger with SHA-256 hash chaining
 * - Human-in-the-loop: Flags for review, not autonomous decisions
 * 
 * DISCLAIMER:
 * This system does NOT determine corruption.
 * It highlights abnormal procurement patterns for human review.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const ledgerRoutes = require('./routes/ledger');
const riskRoutes = require('./routes/risk');
const dashboardRoutes = require('./routes/dashboard');

// Initialize Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'], // Only allow GET and POST (no PUT, PATCH, DELETE)
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count']
}));

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// REQUEST LOGGING
// ============================================

app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
});

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        disclaimer: 'This system does NOT determine corruption. It highlights abnormal procurement patterns for human review.'
    });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Event routes (procurement events)
app.use('/api/events', eventRoutes);

// Ledger verification routes
app.use('/api/verify-ledger', ledgerRoutes);

// Risk analysis routes
app.use('/api/risk', riskRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// ============================================
// BLOCK DANGEROUS METHODS AT APP LEVEL
// Additional safeguard against modification attempts
// ============================================

app.put('*', (req, res) => {
    res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'PUT operations are not permitted. The ledger is append-only.'
    });
});

app.patch('*', (req, res) => {
    res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'PATCH operations are not permitted. The ledger is append-only.'
    });
});

app.delete('*', (req, res) => {
    res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'DELETE operations are not permitted. The ledger is append-only.'
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    res.status(err.status || 500).json({
        success: false,
        error: err.code || 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
            ? 'An internal error occurred'
            : err.message
    });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start listening
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   PROCUREMENT MONITORING SYSTEM                                ║
║   Server running on port ${PORT}                                  ║
║                                                                ║
║   DISCLAIMER:                                                  ║
║   This system does NOT determine corruption.                   ║
║   It highlights abnormal procurement patterns for review.      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

module.exports = app;
