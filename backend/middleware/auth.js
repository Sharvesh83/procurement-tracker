/**
 * Authentication Middleware
 * 
 * Validates JWT tokens and attaches user information to requests.
 * All protected routes must pass through this middleware.
 * 
 * Token format: Bearer <jwt_token>
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT token and attach user to request
 * @param {Request} req 
 * @param {Response} res 
 * @param {Function} next 
 */
const auth = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'No authentication token provided'
            });
        }

        // Validate Bearer token format
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_TOKEN_FORMAT',
                message: 'Token must be in Bearer format'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user and verify they still exist and are active
        const user = await User.findOne({
            _id: decoded.userId,
            isActive: true
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'User no longer exists or is inactive'
            });
        }

        // Attach user and token to request for downstream use
        req.user = user;
        req.token = token;
        req.userId = user._id.toString();
        req.userRole = user.role;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'INVALID_TOKEN',
                message: 'Invalid authentication token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'TOKEN_EXPIRED',
                message: 'Authentication token has expired'
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'AUTH_ERROR',
            message: 'Authentication failed'
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token present
 * Useful for public endpoints that behave differently for authenticated users
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token, continue without user context
            req.user = null;
            req.userRole = null;
            return next();
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({
            _id: decoded.userId,
            isActive: true
        });

        req.user = user;
        req.userRole = user?.role || null;
        req.token = token;

        next();
    } catch (error) {
        // Token invalid but optional, continue without user
        req.user = null;
        req.userRole = null;
        next();
    }
};

module.exports = { auth, optionalAuth };
