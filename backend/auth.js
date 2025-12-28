// /**
//  * Authentication Module
//  * JWT token generation and verification
//  */

// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');

// const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-USE-LONG-RANDOM-STRING';
// const JWT_EXPIRES_IN = '7d';

// /**
//  * Hash password with bcrypt
//  */
// async function hashPassword(password) {
//   const saltRounds = 10;
//   return await bcrypt.hash(password, saltRounds);
// }

// /**
//  * Compare password with hash
//  */
// async function verifyPassword(password, hash) {
//   return await bcrypt.compare(password, hash);
// }

// /**
//  * Generate JWT token
//  */
// function generateToken(employee) {
//   return jwt.sign(
//     { 
//       id: employee.id, 
//       email: employee.email,
//       role: employee.role,
//       name: employee.name
//     },
//     JWT_SECRET,
//     { expiresIn: JWT_EXPIRES_IN }
//   );
// }

// /**
//  * Verify JWT token
//  */
// function verifyToken(token) {
//   try {
//     return jwt.verify(token, JWT_SECRET);
//   } catch (error) {
//     return null;
//   }
// }

// /**
//  * Auth middleware - protect routes
//  */
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

//   if (!token) {
//     return res.status(401).json({ error: 'Access token required' });
//   }

//   const user = verifyToken(token);
  
//   if (!user) {
//     // FIXED: Changed from 403 to 401
//     // 401 = Authentication failed (invalid/expired token)
//     // 403 = Authenticated but lacks permission (valid token, wrong role)
//     return res.status(401).json({ error: 'Invalid or expired token' });
//   }

//   req.user = user;
//   next();
// }

// /**
//  * Optional auth - allows both authenticated and unauthenticated
//  */
// function optionalAuth(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (token) {
//     const user = verifyToken(token);
//     if (user) {
//       req.user = user;
//     }
//   }
  
//   next();
// }

// module.exports = {
//   hashPassword,
//   verifyPassword,
//   generateToken,
//   verifyToken,
//   authenticateToken,
//   optionalAuth,
// };

/**
 * Authentication Module
 * JWT token generation and verification
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-USE-LONG-RANDOM-STRING';
const JWT_EXPIRES_IN = '7d';

// Log JWT configuration on startup
console.log('🔐 Auth Module Loaded');
console.log('  JWT_SECRET:', JWT_SECRET ? '***' + JWT_SECRET.substring(JWT_SECRET.length - 4) : 'NOT SET');
console.log('  JWT_EXPIRES_IN:', JWT_EXPIRES_IN);

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
 * Generate JWT token
 */
function generateToken(employee) {
  console.log('🎫 Generating token for:', {
    id: employee.id,
    email: employee.email,
    role: employee.role,
    name: employee.name
  });
  
  const token = jwt.sign(
    { 
      id: employee.id, 
      email: employee.email,
      role: employee.role,
      name: employee.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  console.log('✅ Token generated:', token.substring(0, 30) + '...');
  return token;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    console.log('🔍 Verifying token:', token.substring(0, 30) + '...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token valid, decoded:', decoded);
    return decoded;
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return null;
  }
}

/**
 * Auth middleware - protect routes
 */
function authenticateToken(req, res, next) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 AUTH MIDDLEWARE - Checking authentication');
  console.log('  Endpoint:', req.method, req.path);
  
  const authHeader = req.headers['authorization'];
  console.log('  Auth header:', authHeader || '❌ MISSING');
  
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('  ❌ DENIED: No token provided');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(401).json({ error: 'Access token required' });
  }
  
  console.log('  Token received:', token.substring(0, 30) + '...');

  const user = verifyToken(token);
  
  if (!user) {
    console.log('  ❌ DENIED: Invalid or expired token');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  console.log('  ✅ ALLOWED: User authenticated');
  console.log('  User:', user);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
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

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateToken,
  optionalAuth,
};