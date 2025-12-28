const db = require('./db');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });
  
  next();
}

/**
 * Shop domain verification middleware
 */
function verifyShopDomain(req, res, next) {
  const shopDomain = req.get('X-Shop-Domain');
  
  if (!shopDomain) {
    return res.status(401).json({ 
      error: 'Missing X-Shop-Domain header' 
    });
  }
  
  // Validate shop domain format
  const shopDomainRegex = /^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/i;
  
  if (!shopDomainRegex.test(shopDomain)) {
    return res.status(400).json({ 
      error: 'Invalid shop domain format' 
    });
  }
  
  req.shopDomain = shopDomain;
  next();
}

/**
 * Store identifier verification middleware
 */
async function verifyStoreIdentifier(req, res, next) {
  try {
    const storeId = req.get('X-Store-Id') || req.params.storeId || req.query.storeId || req.body.storeId;
    
    if (!storeId) {
      return res.status(401).json({ 
        error: 'Missing store identifier (X-Store-Id header, storeId param, or storeId in body)' 
      });
    }
    
    // Validate store identifier format
    const storeIdRegex = /^store_[a-z0-9_]+$/i;
    
    if (!storeIdRegex.test(storeId)) {
      return res.status(400).json({ 
        error: 'Invalid store identifier format (expected: store_xxx)' 
      });
    }
    
    // Fetch store from database
    const store = await db.getStoreByIdentifier(storeId);
    
    if (!store) {
      return res.status(404).json({ 
        error: 'Store not found or inactive' 
      });
    }
    
    // Attach store to request
    req.store = store;
    req.storeId = storeId;
    
    next();
  } catch (error) {
    console.error('Store verification error:', error);
    res.status(500).json({ error: 'Store verification failed' });
  }
}

/**
 * Employee authentication middleware
 */
async function verifyEmployee(req, res, next) {
  try {
    const employeeEmail = req.get('X-Employee-Email') || req.query.employeeEmail;
    const apiToken = req.get('X-API-Token') || req.query.apiToken;
    
    if (!employeeEmail && !apiToken) {
      return res.status(401).json({ 
        error: 'Missing employee credentials (X-Employee-Email or X-API-Token)' 
      });
    }
    
    let employee;
    
    if (apiToken) {
      // Verify by API token
      employee = await db.db.select()
        .from(db.schema.employees)
        .where(db.eq(db.schema.employees.apiToken, apiToken))
        .limit(1);
      employee = employee[0];
    } else {
      // Verify by email
      employee = await db.getEmployeeByEmail(employeeEmail);
    }
    
    if (!employee) {
      return res.status(404).json({ 
        error: 'Employee not found or inactive' 
      });
    }
    
    // Attach employee to request
    req.employee = employee;
    
    next();
  } catch (error) {
    console.error('Employee verification error:', error);
    res.status(500).json({ error: 'Employee verification failed' });
  }
}

/**
 * Rate limiting middleware (simple implementation)
 */
const requestCounts = new Map();

function rateLimiter(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 100,
  } = options;
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }
    
    const requests = requestCounts.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later',
      });
    }
    
    validRequests.push(now);
    requestCounts.set(key, validRequests);
    
    next();
  };
}

/**
 * API rate limiter (stricter for API endpoints)
 */
function apiRateLimiter() {
  return rateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 60, // 1 request per second
  });
}

/**
 * Input validation middleware
 */
function validateInput(schema) {
  return (req, res, next) => {
    const errors = [];
    
    Object.entries(schema).forEach(([field, rules]) => {
      const value = req.body[field];
      
      if (rules.required && !value) {
        errors.push(`${field} is required`);
      }
      
      if (value && rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }
      
      if (value && rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must not exceed ${rules.maxLength} characters`);
      }
      
      if (value && rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      
      if (value && rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
      
      if (value && rules.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field} must be a valid email`);
        }
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    
    next();
  };
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({ 
      error: 'Duplicate entry',
      details: err.detail 
    });
  }
  
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ 
      error: 'Referenced record does not exist' 
    });
  }
  
  // Drizzle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: err.message 
    });
  }
  
  // Shopify API errors
  if (err.message && err.message.includes('Shopify API error')) {
    return res.status(502).json({
      error: 'Shopify API error',
      details: err.message
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * CORS configuration
 */
function configureCORS(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.get('origin');
    
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shop-Domain, X-Store-Id, X-Employee-Email, X-API-Token');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
}

/**
 * Request body size limiter
 */
function bodyLimit(maxSize = '10mb') {
  return (req, res, next) => {
    if (req.headers['content-length']) {
      const size = parseInt(req.headers['content-length']);
      const maxBytes = parseSize(maxSize);
      
      if (size > maxBytes) {
        return res.status(413).json({
          error: 'Request body too large',
          maxSize
        });
      }
    }
    next();
  };
}

function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.match(/^(\d+)(b|kb|mb|gb)$/i);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  return parseInt(match[1]) * units[match[2].toLowerCase()];
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  requestLogger,
  verifyShopDomain,
  verifyStoreIdentifier,
  verifyEmployee,
  rateLimiter,
  apiRateLimiter,
  validateInput,
  errorHandler,
  configureCORS,
  securityHeaders,
  bodyLimit,
  asyncHandler,
};