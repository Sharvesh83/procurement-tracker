/**
 * Role-Based Access Control Middleware
 * 
 * Enforces role-based permissions on routes.
 * Must be used AFTER the auth middleware.
 * 
 * Access Control Matrix:
 * | Role                | POST Events | GET Events | GET Reports |
 * |---------------------|-------------|------------|-------------|
 * | PROCUREMENT_OFFICER | ✓           | ✓          | ✓           |
 * | AUDITOR             | ✗           | ✓          | ✓           |
 * 
 * IMPORTANT: No role can update or delete events.
 * The ledger is strictly append-only.
 */

const { ROLES } = require('../config/constants');

/**
 * Create a role guard middleware that allows only specified roles
 * @param  {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Express middleware
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // Ensure auth middleware has run first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'NOT_AUTHENTICATED',
                message: 'Authentication required before role check'
            });
        }

        // Check if user's role is in allowed list
        if (!allowedRoles.includes(req.userRole)) {
            return res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSIONS',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
                required_roles: allowedRoles,
                current_role: req.userRole
            });
        }

        next();
    };
};

/**
 * Middleware that allows only Procurement Officers
 * Used for event submission endpoints
 */
const procurementOfficerOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'NOT_AUTHENTICATED',
            message: 'Authentication required'
        });
    }

    if (req.userRole !== ROLES.PROCUREMENT_OFFICER) {
        return res.status(403).json({
            success: false,
            error: 'PROCUREMENT_OFFICER_ONLY',
            message: 'Only Procurement Officers can submit procurement events',
            explanation: 'This is a write operation restricted to authorized submitters'
        });
    }

    next();
};

/**
 * Middleware that allows any authenticated user (read-only access)
 * Used for viewing events, reports, and dashboards
 */
const anyAuthenticatedUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'NOT_AUTHENTICATED',
            message: 'Authentication required to view this resource'
        });
    }

    // All authenticated users can read
    next();
};

/**
 * Middleware specifically for Auditors
 * Typically used alongside other checks
 */
const auditorOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'NOT_AUTHENTICATED',
            message: 'Authentication required'
        });
    }

    if (req.userRole !== ROLES.AUDITOR) {
        return res.status(403).json({
            success: false,
            error: 'AUDITOR_ONLY',
            message: 'Only Auditors can access this resource'
        });
    }

    next();
};

/**
 * Block all write operations - used as an additional safeguard
 * This is applied at the route level for extra protection
 */
const blockWriteOperations = (req, res, next) => {
    const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

    if (writeMethod && req.userRole === ROLES.AUDITOR) {
        return res.status(403).json({
            success: false,
            error: 'READ_ONLY_ACCESS',
            message: 'Auditors have read-only access and cannot perform write operations',
            explanation: 'This ensures audit integrity by preventing reviewers from modifying data'
        });
    }

    next();
};

/**
 * Absolute block on update/delete for ANY role
 * This is the final safeguard for ledger immutability
 */
const blockLedgerModification = (req, res, next) => {
    const modificationMethods = ['PUT', 'PATCH', 'DELETE'];

    if (modificationMethods.includes(req.method)) {
        return res.status(403).json({
            success: false,
            error: 'LEDGER_IMMUTABLE',
            message: 'The procurement ledger is append-only and cannot be modified',
            explanation: 'This ensures tamper-evidence and audit integrity. No role has permission to alter historical records.'
        });
    }

    next();
};

module.exports = {
    requireRole,
    procurementOfficerOnly,
    anyAuthenticatedUser,
    auditorOnly,
    blockWriteOperations,
    blockLedgerModification
};
