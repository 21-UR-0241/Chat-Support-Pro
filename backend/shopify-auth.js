/**
 * Shopify OAuth
 */

const crypto = require('crypto');

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || 'read_customers,read_orders';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function getAuthUrl(shop) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${APP_URL}/auth/callback`;

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${nonce}`;

  return authUrl;
}

async function handleCallback(req, res) {
  const { shop, code, state } = req.query;

  if (!shop || !code) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenData = {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });

    const data = await response.json();

    if (data.access_token) {
      // Store access token securely
      console.log('Access token obtained for shop:', shop);

      // Redirect to success page
      res.redirect(`/admin?shop=${shop}&installed=true`);
    } else {
      res.status(400).json({ error: 'Failed to obtain access token' });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth failed' });
  }
}

module.exports = {
  getAuthUrl,
  handleCallback
};