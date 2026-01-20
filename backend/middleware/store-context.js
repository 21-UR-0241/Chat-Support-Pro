// backend/middleware/store-context.js
const db = require('../database');

/**
 * Store Context Middleware
 * Ensures user has access to the requested store
 */
async function ensureStoreContext(req, res, next) {
  try {
    const storeId = req.query.storeId || req.body.storeId || req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }
    
    // Get store
    const store = await db.getStoreById(parseInt(storeId));
    
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    if (!store.is_active) {
      return res.status(403).json({ error: 'Store is inactive' });
    }
    
    // Check employee permissions
    if (req.user) {
      const canAccess = req.user.can_view_all_stores || 
                       req.user.assigned_stores?.includes(store.id) ||
                       req.user.role === 'admin';
      
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }
    }
    
    // Attach store to request
    req.store = store;
    next();
  } catch (error) {
    console.error('Store context error:', error);
    res.status(500).json({ error: 'Store context error' });
  }
}

/**
 * Optional store context (doesn't fail if missing)
 */
async function optionalStoreContext(req, res, next) {
  try {
    const storeId = req.query.storeId || req.body.storeId || req.params.storeId;
    
    if (storeId) {
      const store = await db.getStoreById(parseInt(storeId));
      if (store && store.is_active) {
        req.store = store;
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional store context error:', error);
    next(); // Continue anyway
  }
}

module.exports = {
  ensureStoreContext,
  optionalStoreContext
};