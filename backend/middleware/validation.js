/**
 * Request Validation Middleware
 * 
 * Provides validation functions for incoming requests.
 * Uses express-validator for schema validation.
 */

const { body, param, query, validationResult } = require('express-validator');
const { EVENT_TYPES } = require('../config/constants');

/**
 * Handle validation errors
 * Returns 400 with detailed error messages if validation fails
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }

    next();
};

/**
 * Validation rules for event submission
 */
const validateEventSubmission = [
    body('tender_id')
        .trim()
        .notEmpty().withMessage('Tender ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Tender ID must be 1-100 characters'),

    body('event_type')
        .trim()
        .notEmpty().withMessage('Event type is required')
        .isIn(Object.values(EVENT_TYPES)).withMessage(`Event type must be one of: ${Object.values(EVENT_TYPES).join(', ')}`),

    body('department_id')
        .trim()
        .notEmpty().withMessage('Department ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Department ID must be 1-100 characters'),

    body('supplier_id')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 100 }).withMessage('Supplier ID must not exceed 100 characters'),

    body('bid_count')
        .optional({ nullable: true })
        .isInt({ min: 0 }).withMessage('Bid count must be a non-negative integer'),

    body('award_rank')
        .optional({ nullable: true })
        .isInt({ min: 1 }).withMessage('Award rank must be a positive integer'),

    body('contract_amount')
        .optional({ nullable: true })
        .isFloat({ min: 0 }).withMessage('Contract amount must be a non-negative number'),

    body('payment_amount')
        .optional({ nullable: true })
        .isFloat({ min: 0 }).withMessage('Payment amount must be a non-negative number'),

    body('currency')
        .optional()
        .trim()
        .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code')
        .isUppercase().withMessage('Currency must be uppercase'),

    body('event_date')
        .notEmpty().withMessage('Event date is required')
        .isISO8601().withMessage('Event date must be a valid ISO-8601 date'),

    body('fiscal_period')
        .trim()
        .notEmpty().withMessage('Fiscal period is required')
        .matches(/^\d{4}-Q[1-4]$/).withMessage('Fiscal period must be in YYYY-QX format (e.g., 2024-Q3)'),

    handleValidationErrors
];

/**
 * Validation rules for user registration
 */
const validateUserRegistration = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),

    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Invalid email format'),

    body('role')
        .optional()
        .isIn(['PROCUREMENT_OFFICER', 'AUDITOR']).withMessage('Role must be PROCUREMENT_OFFICER or AUDITOR'),

    body('fullName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Full name must not exceed 100 characters'),

    body('departmentId')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Department ID must not exceed 100 characters'),

    handleValidationErrors
];

/**
 * Validation rules for login
 */
const validateLogin = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required'),

    body('password')
        .notEmpty().withMessage('Password is required'),

    handleValidationErrors
];

/**
 * Validation for tender ID parameter
 */
const validateTenderId = [
    param('tenderId')
        .trim()
        .notEmpty().withMessage('Tender ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Tender ID must be 1-100 characters'),

    handleValidationErrors
];

/**
 * Validation for department ID parameter
 */
const validateDepartmentId = [
    param('departmentId')
        .trim()
        .notEmpty().withMessage('Department ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Department ID must be 1-100 characters'),

    handleValidationErrors
];

/**
 * Validation for supplier ID parameter
 */
const validateSupplierId = [
    param('supplierId')
        .trim()
        .notEmpty().withMessage('Supplier ID is required')
        .isLength({ min: 1, max: 100 }).withMessage('Supplier ID must be 1-100 characters'),

    handleValidationErrors
];

/**
 * Validation for pagination query params
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateEventSubmission,
    validateUserRegistration,
    validateLogin,
    validateTenderId,
    validateDepartmentId,
    validateSupplierId,
    validatePagination
};
