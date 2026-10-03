"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStrictRole = exports.requireRole = exports.verifyAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'dineflow-super-secret-jwt-key-2026-production';
const verifyAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication token missing or invalid format',
        });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (!decoded.restaurantId || !decoded.role) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token payload: restaurant or role missing',
            });
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired session token',
        });
    }
};
exports.verifyAuth = verifyAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User authentication required',
            });
        }
        // ADMIN can access all operational routes as supervisor if needed, or specific roles
        if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
            return next();
        }
        return res.status(403).json({
            success: false,
            error: `Access Denied: Your account role (${req.user.role}) is not authorized to access this module. Required: [${allowedRoles.join(', ')}]`,
        });
    };
};
exports.requireRole = requireRole;
const requireStrictRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User authentication required',
            });
        }
        if (allowedRoles.includes(req.user.role)) {
            return next();
        }
        return res.status(403).json({
            success: false,
            error: `Access Denied: Strict role required [${allowedRoles.join(', ')}]. Logged in as ${req.user.role}.`,
        });
    };
};
exports.requireStrictRole = requireStrictRole;
