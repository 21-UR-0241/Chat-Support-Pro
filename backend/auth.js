/**
 * Authentication Module - Production Ready
 * JWT token generation and verification
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Widget tokens (separate secret recommended)
const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET || JWT_SECRET;
const WIDGET_JWT_EXPIRES_IN = process.env.WIDGET_JWT_EXPIRES_IN || '2h';

// ✅ Enforce JWT secret in production
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate employee JWT token
 */
function generateToken(employee) {
  return jwt.sign(
    { 
      id: employee.id, 
      email: employee.email,
      role: employee.role,
      name: employee.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify employee JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Token verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Generate widget JWT token
 */
function generateWidgetToken(store) {
  return jwt.sign(
    {
      storeId: store.id,
      storeIdentifier: store.store_identifier,
      shopDomain: store.shop_domain,
      type: 'widget'
    },
    WIDGET_JWT_SECRET,
    { expiresIn: WIDGET_JWT_EXPIRES_IN }
  );
}

/**
 * Verify widget JWT token
 */
function verifyWidgetToken(token) {
  try {
    return jwt.verify(token, WIDGET_JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Auth middleware - protect routes
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  next();
}

/**
 * Optional auth - allows both authenticated and unauthenticated
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Admin-only middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Check if user can access store
 */
function canAccessStore(employee, storeId) {
  // Admin or employees who can view all stores
  if (employee.role === 'admin' || employee.can_view_all_stores) {
    return true;
  }

  // Check if store is in assigned stores
  if (employee.assigned_stores && employee.assigned_stores.includes(storeId)) {
    return true;
  }

  return false;
}

/**
 * Middleware to verify store access
 */
function verifyStoreAccess(req, res, next) {
  const storeId = parseInt(req.params.storeId || req.query.storeId || req.body.storeId);

  if (!storeId) {
    return res.status(400).json({ error: 'Store ID required' });
  }

  if (!canAccessStore(req.user, storeId)) {
    return res.status(403).json({ error: 'Access to this store is not authorized' });
  }

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateWidgetToken,
  verifyWidgetToken,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  canAccessStore,
  verifyStoreAccess,
};