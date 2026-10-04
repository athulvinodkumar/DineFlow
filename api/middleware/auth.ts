import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthUser, UserRole } from '../../lib/types';

const JWT_SECRET = process.env.JWT_SECRET || 'dineflow-super-secret-jwt-key-2026-production';

export const verifyAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token missing or invalid format',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    if (!decoded.restaurantId || !decoded.role) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload: restaurant or role missing',
      });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token',
    });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export const requireStrictRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
