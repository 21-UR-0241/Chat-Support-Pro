/**
 * Widget API Endpoints
 * Add these to your server.js
 * 
 * These endpoints support the multi-store chat widget
 */

const express = require('express');
const router = express.Router();
const db = require('./db');

// ============ PUBLIC WIDGET ENDPOINTS ============
// These endpoints don't require authentication (called by widget)

/**
 * Verify store is registered and active
 * GET /api/stores/verify?domain=storea.myshopify.com
 */
router.get('/verify', async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'domain parameter required' });
    }
    
    console.log('📋 Store verification request:', domain);
    
    const store = await db.getStoreByDomain(domain);
    
    if (!store) {
      console.log('  ❌ Store not found in database');
      return res.status(404).json({ 
        error: 'Store not found',
        message: 'This store has not installed the chat app yet. Please install from the Shopify App Store.',
        domain
      });
    }
    
    if (!store.isActive) {
      console.log('  ❌ Store is inactive');
      return res.status(403).json({
        error: 'Store inactive',
        message: 'This store\'s chat app subscription is inactive. Please contact support.',
        domain
      });
    }
    
    console.log('  ✅ Store verified:', store.id);
    
    res.json({
      storeId: store.id,
      storeIdentifier: store.storeIdentifier,
      shopDomain: store.shopDomain,
      brandName: store.brandName,
      active: store.isActive,
      verified: true
    });
  } catch (error) {
    console.error('❌ Store verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Get widget settings for a store
 * GET /api/widget/settings?store=storea
 */
router.get('/settings', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    
    if (!storeIdentifier) {
      return res.status(400).json({ error: 'store parameter required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    
    if (!store || !store.isActive) {
      return res.status(404).json({ error: 'Store not found or inactive' });
    }
    
    // Return widget-safe settings (no sensitive data)
    res.json({
      storeId: store.id,
      storeIdentifier: store.storeIdentifier,
      brandName: store.brandName,
      primaryColor: store.primaryColor || '#667eea',
      logoUrl: store.logoUrl,
      widgetSettings: store.widgetSettings || {
        position: 'bottom-right',
        greeting: 'Hi! How can we help you today?',
        placeholder: 'Type your message...',
        showAvatar: true,
        soundEnabled: true
      },
      businessHours: store.businessHours,
      timezone: store.timezone || 'UTC'
    });
  } catch (error) {
    console.error('Widget settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * Track widget installation/load
 * POST /api/widget/installed
 */
router.post('/installed', async (req, res) => {
  try {
    const { 
      storeIdentifier, 
      shopDomain, 
      version, 
      timestamp,
      hasCustomer 
    } = req.body;
    
    console.log('📊 Widget installed:', {
      storeIdentifier,
      version,
      hasCustomer
    });
    
    // Optional: Track in analytics
    // await db.trackWidgetInstallation(storeIdentifier, version);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Widget installation tracking error:', error);
    res.status(200).json({ success: false }); // Don't fail widget load
  }
});

/**
 * Track widget interactions
 * POST /api/widget/interaction
 */
router.post('/interaction', async (req, res) => {
  try {
    const { 
      storeIdentifier, 
      event, 
      timestamp,
      metadata 
    } = req.body;
    
    console.log('📊 Widget interaction:', {
      storeIdentifier,
      event
    });
    
    // Optional: Track in analytics
    // await db.trackWidgetInteraction(storeIdentifier, event, metadata);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Widget interaction tracking error:', error);
    res.status(200).json({ success: false }); // Don't fail widget
  }
});

/**
 * Get store availability status
 * GET /api/widget/availability?store=storea
 */
router.get('/availability', async (req, res) => {
  try {
    const { store: storeIdentifier } = req.query;
    
    if (!storeIdentifier) {
      return res.status(400).json({ error: 'store parameter required' });
    }
    
    const store = await db.getStoreByIdentifier(storeIdentifier);
    
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    // Check business hours
    const isWithinBusinessHours = checkBusinessHours(store.businessHours, store.timezone);
    
    // Check if agents are online
    const agentsOnline = await db.query(
      'SELECT COUNT(*) FROM employees WHERE is_online = true'
    );
    const hasAgentsOnline = parseInt(agentsOnline.rows[0].count) > 0;
    
    res.json({
      available: isWithinBusinessHours && hasAgentsOnline,
      withinBusinessHours: isWithinBusinessHours,
      agentsOnline: hasAgentsOnline,
      message: getAvailabilityMessage(isWithinBusinessHours, hasAgentsOnline)
    });
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

/**
 * Health check for widget
 * GET /api/widget/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// ============ HELPER FUNCTIONS ============

/**
 * Check if current time is within business hours
 */
function checkBusinessHours(businessHours, timezone) {
  if (!businessHours) return true; // Always available if not configured
  
  try {
    // Get current time in store's timezone
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase', timeZone: timezone });
    const currentHour = parseInt(now.toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: timezone }));
    
    const hours = businessHours[dayOfWeek];
    if (!hours || !hours.enabled) return false;
    
    return currentHour >= hours.start && currentHour < hours.end;
  } catch (error) {
    console.error('Business hours check error:', error);
    return true; // Default to available on error
  }
}

/**
 * Get availability message
 */
function getAvailabilityMessage(withinHours, hasAgents) {
  if (withinHours && hasAgents) {
    return 'Our team is available now!';
  } else if (!withinHours) {
    return 'We\'re currently outside business hours. We\'ll respond when we\'re back!';
  } else if (!hasAgents) {
    return 'All agents are currently busy. We\'ll respond as soon as possible!';
  } else {
    return 'Leave us a message and we\'ll get back to you soon!';
  }
}

module.exports = router;

// ============ HOW TO ADD TO SERVER.JS ============
/*

const widgetRoutes = require('./widget-routes');

// Public widget endpoints (no authentication required)
app.use('/api/widget', widgetRoutes);

// Also update your stores endpoints to include:
app.use('/api/stores', widgetRoutes);

*/