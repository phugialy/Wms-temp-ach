import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

/**
 * Extended Request interface to include user info
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'OPERATOR' | 'ADMIN' | 'MANAGER';
    is_verified: boolean;
    is_active: boolean;
  };
}

/**
 * Authentication middleware
 * Verifies Supabase JWT token and checks user status in wms_users table
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No authorization token provided'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Authentication failed: Invalid token', {
        error: authError?.message,
        path: req.path
      });
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      });
      return;
    }

    // Verify user exists in wms_users table and is active
    const { data: wmsUser, error: userError } = await supabase
      .from('wms_users')
      .select('*')
      .eq('id', user.id)
      .eq('app_identifier', 'WMS')
      .single();

    if (userError || !wmsUser) {
      logger.warn('Authentication failed: User not found in wms_users', {
        userId: user.id,
        path: req.path
      });
      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'User not found or not registered'
      });
      return;
    }

    // Check if user is active
    if (!wmsUser.is_active) {
      logger.warn('Authentication failed: User account is inactive', {
        userId: user.id,
        path: req.path
      });
      res.status(403).json({
        success: false,
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
      return;
    }

    // Check if user is verified (optional - can be made required)
    if (!wmsUser.is_verified) {
      logger.warn('Authentication failed: User account not verified', {
        userId: user.id,
        path: req.path
      });
      res.status(403).json({
        success: false,
        error: 'Account not verified',
        message: 'Please verify your email address before accessing the application.'
      });
      return;
    }

    // Attach user info to request object
    req.user = {
      id: wmsUser.id,
      email: wmsUser.email,
      role: wmsUser.role as 'OPERATOR' | 'ADMIN' | 'MANAGER',
      is_verified: wmsUser.is_verified,
      is_active: wmsUser.is_active,
    };

    // Continue to next middleware/route handler
    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Role-based authorization middleware
 * Must be used after authenticate middleware
 */
export const requireRole = (...allowedRoles: ('OPERATOR' | 'ADMIN' | 'MANAGER')[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (!authError && user) {
      const { data: wmsUser } = await supabase
        .from('wms_users')
        .select('*')
        .eq('id', user.id)
        .eq('app_identifier', 'WMS')
        .single();

      if (wmsUser && wmsUser.is_active) {
        req.user = {
          id: wmsUser.id,
          email: wmsUser.email,
          role: wmsUser.role as 'OPERATOR' | 'ADMIN' | 'MANAGER',
          is_verified: wmsUser.is_verified,
          is_active: wmsUser.is_active,
        };
      }
    }

    next();
  } catch (error) {
    // If optional auth fails, just continue without user
    next();
  }
};

