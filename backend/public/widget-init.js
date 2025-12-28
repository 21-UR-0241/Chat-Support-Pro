/**
 * Multi-Store Chat Widget Initializer
 * Production-ready widget loader for Shopify stores
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  
  const CONFIG = {
    // Auto-detect API URL from script source or use environment variable
    apiUrl: (function() {
      // Try to get from script tag data attribute first
      const currentScript = document.currentScript || (function() {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
      })();
      
      if (currentScript && currentScript.dataset.apiUrl) {
        return currentScript.dataset.apiUrl;
      }
      
      // Try to extract from script src
      if (currentScript && currentScript.src) {
        const url = new URL(currentScript.src);
        return url.origin;
      }
      
      // Fallback - will be replaced during build/deployment
      return '${API_URL}' !== '${API_URL}' 
        ? '${API_URL}' 
        : window.location.protocol + '//' + window.location.host;
    })(),
    
    // WebSocket URL (auto-detect protocol)
    wsUrl: null, // Will be set based on apiUrl
    
    // Widget version
    version: '1.0.0',
    
    // CDN URLs (optional - for faster loading)
    cdn: {
      enabled: false,
      baseUrl: '', // e.g., 'https://cdn.your-domain.com'
    },
    
    // Feature flags
    features: {
      analytics: true,
      notifications: true,
      soundEffects: true,
    },
    
    // Performance
    lazyLoad: true,
    preload: false,
    
    // Debug mode (disable in production)
    debug: false,
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  /**
   * Logger with conditional output
   */
  const log = {
    info: function(...args) {
      if (CONFIG.debug) console.log('[ChatWidget]', ...args);
    },
    error: function(...args) {
      console.error('[ChatWidget Error]', ...args);
    },
    warn: function(...args) {
      if (CONFIG.debug) console.warn('[ChatWidget Warning]', ...args);
    }
  };

  /**
   * Get Shopify store information
   */
  function getStoreInfo() {
    const info = {
      shop: null,
      storeId: null,
      customerId: null,
      customerEmail: null,
      customerName: null,
    };
    
    // Get shop domain
    if (window.Shopify && window.Shopify.shop) {
      info.shop = window.Shopify.shop;
      info.storeId = window.Shopify.shop.replace('.myshopify.com', '');
    }
    
    // Try to get from meta tags (theme customization)
    const shopMeta = document.querySelector('meta[name="shopify-shop"]');
    if (shopMeta) {
      info.shop = shopMeta.content;
      info.storeId = shopMeta.content.replace('.myshopify.com', '');
    }
    
    // Get customer info (if logged in)
    if (window.Shopify && window.Shopify.customer) {
      info.customerId = window.Shopify.customer.id;
      info.customerEmail = window.Shopify.customer.email;
      info.customerName = window.Shopify.customer.first_name && window.Shopify.customer.last_name
        ? `${window.Shopify.customer.first_name} ${window.Shopify.customer.last_name}`
        : window.Shopify.customer.email;
    }
    
    return info;
  }

  /**
   * Check if widget is already loaded
   */
  function isWidgetLoaded() {
    return window.MultiStoreChatWidget && document.getElementById('multi-store-chat-widget');
  }

  /**
   * Load CSS file
   */
  function loadCSS(url) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`link[href="${url}"]`);
      if (existing) {
        resolve();
        return;
      }
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  /**
   * Load JavaScript file
   */
  function loadJS(url) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  /**
   * Create widget container
   */
  function createContainer() {
    if (document.getElementById('multi-store-chat-widget')) {
      return;
    }
    
    const container = document.createElement('div');
    container.id = 'multi-store-chat-widget';
    container.setAttribute('data-version', CONFIG.version);
    document.body.appendChild(container);
    
    log.info('Widget container created');
  }

  /**
   * Determine WebSocket URL
   */
  function getWebSocketUrl(apiUrl) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws`;
    } catch (error) {
      log.error('Failed to parse WebSocket URL:', error);
      return null;
    }
  }

  /**
   * Initialize widget with configuration
   */
  function initializeWidget() {
    const storeInfo = getStoreInfo();
    
    if (!storeInfo.storeId) {
      log.error('Store ID not found. Make sure this is a Shopify store.');
      return;
    }
    
    log.info('Initializing widget for store:', storeInfo.storeId);
    
    // Set WebSocket URL
    CONFIG.wsUrl = CONFIG.wsUrl || getWebSocketUrl(CONFIG.apiUrl);
    
    // Initialize widget
    if (window.MultiStoreChatWidget && typeof window.MultiStoreChatWidget.init === 'function') {
      window.MultiStoreChatWidget.init({
        storeId: storeInfo.storeId,
        shop: storeInfo.shop,
        apiUrl: CONFIG.apiUrl,
        wsUrl: CONFIG.wsUrl,
        customer: {
          id: storeInfo.customerId,
          email: storeInfo.customerEmail,
          name: storeInfo.customerName,
        },
        features: CONFIG.features,
        debug: CONFIG.debug,
      });
      
      log.info('Widget initialized successfully');
      
      // Track installation
      trackInstallation(storeInfo);
    } else {
      log.error('MultiStoreChatWidget not found. Widget script may have failed to load.');
    }
  }

  /**
   * Track widget installation (optional analytics)
   */
  function trackInstallation(storeInfo) {
    if (!CONFIG.features.analytics) return;
    
    try {
      // Send installation ping (optional)
      fetch(`${CONFIG.apiUrl}/api/widget/installed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: storeInfo.storeId,
          version: CONFIG.version,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // Fail silently
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Load widget assets and initialize
   */
  async function loadWidget() {
    try {
      log.info('Loading widget assets from:', CONFIG.apiUrl);
      
      const baseUrl = CONFIG.cdn.enabled ? CONFIG.cdn.baseUrl : CONFIG.apiUrl;
      const cssUrl = `${baseUrl}/widget.css?v=${CONFIG.version}`;
      const jsUrl = `${baseUrl}/widget.js?v=${CONFIG.version}`;
      
      // Create container first
      createContainer();
      
      // Load CSS and JS in parallel
      await Promise.all([
        loadCSS(cssUrl),
        loadJS(jsUrl),
      ]);
      
      // Initialize widget
      initializeWidget();
      
    } catch (error) {
      log.error('Failed to load widget:', error);
      
      // Show error message to store owner (only in debug mode)
      if (CONFIG.debug) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#f44336;color:white;padding:12px;border-radius:4px;z-index:999999;font-size:14px;';
        errorDiv.textContent = 'Chat widget failed to load. Check console for details.';
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
      }
    }
  }

  /**
   * Wait for DOM to be ready
   */
  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  /**
   * Main initialization
   */
  function init() {
    // Prevent multiple initializations
    if (window.__MULTI_STORE_CHAT_LOADED) {
      log.warn('Widget already loaded');
      return;
    }
    
    window.__MULTI_STORE_CHAT_LOADED = true;
    
    // Check if already loaded
    if (isWidgetLoaded()) {
      log.info('Widget already exists in DOM');
      return;
    }
    
    log.info('Starting widget initialization...');
    
    onReady(() => {
      if (CONFIG.lazyLoad && !CONFIG.preload) {
        // Lazy load on user interaction
        const events = ['mousemove', 'scroll', 'touchstart', 'click'];
        const loadOnce = () => {
          events.forEach(event => document.removeEventListener(event, loadOnce));
          loadWidget();
        };
        events.forEach(event => document.addEventListener(event, loadOnce, { once: true, passive: true }));
        
        // Fallback: load after 5 seconds if no interaction
        setTimeout(loadOnce, 5000);
      } else {
        // Load immediately
        loadWidget();
      }
    });
  }

  // ============================================
  // EXPOSE PUBLIC API
  // ============================================
  
  window.MultiStoreChatWidgetLoader = {
    version: CONFIG.version,
    init: init,
    config: CONFIG,
    reload: function() {
      window.__MULTI_STORE_CHAT_LOADED = false;
      init();
    }
  };

  // ============================================
  // AUTO-INITIALIZE
  // ============================================
  
  init();

})();