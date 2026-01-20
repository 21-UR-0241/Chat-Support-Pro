// backend/sanitizer.js
const DOMPurify = require('isomorphic-dompurify');

/**
 * Input Sanitizer
 * Protects against XSS and injection attacks
 */
class Sanitizer {
  /**
   * Sanitize message content
   */
  sanitizeMessage(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Remove all HTML tags but keep line breaks
    const cleaned = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
    
    // Trim and limit length
    return cleaned.trim().substring(0, 10000);
  }

  /**
   * Sanitize customer name
   */
  sanitizeName(name) {
    if (!name || typeof name !== 'string') {
      return 'Guest';
    }
    
    // Remove special characters except spaces, hyphens, apostrophes
    const cleaned = name.replace(/[^a-zA-Z0-9\s\-']/g, '');
    
    return cleaned.trim().substring(0, 100) || 'Guest';
  }

  /**
   * Sanitize email
   */
  sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    
    const cleaned = email.toLowerCase().trim();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return emailRegex.test(cleaned) ? cleaned : '';
  }

  /**
   * Sanitize store identifier
   */
  sanitizeStoreIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return '';
    }
    
    // Only allow alphanumeric, hyphens, underscores
    return identifier.replace(/[^a-zA-Z0-9\-_]/g, '').toLowerCase();
  }

  /**
   * Sanitize URL
   */
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      
      return parsed.toString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Sanitize JSON data
   */
  sanitizeJson(data) {
    if (!data) return null;
    
    try {
      const str = JSON.stringify(data);
      const parsed = JSON.parse(str);
      return parsed;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new Sanitizer();