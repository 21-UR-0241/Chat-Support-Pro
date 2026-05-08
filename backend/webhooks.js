// backend/webhooks.js
const crypto = require('crypto');
const db = require('./database');
const queueManager = require('./queue-manager');

function rawBodyMiddleware(req, res, next) {
  let data = '';
  let tooLarge = false;

  req.setEncoding('utf8');

  req.on('data', chunk => {
    data += chunk;
    if (data.length > 1_000_000) { // 1MB
      tooLarge = true;
      req.destroy();
    }
  });

  req.on('end', () => {
    if (tooLarge) {
      return res.status(413).send('Payload too large');
    }
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
}

/**
 * Verify Shopify webhook HMAC (timing-safe)
 */
function verifyWebhook(rawBody, hmacHeader) {
  if (!process.env.SHOPIFY_API_SECRET) {
    console.warn('⚠️ SHOPIFY_API_SECRET not set - skipping webhook verification');
    return true;
  }

  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'utf8'),
    Buffer.from(hmacHeader || '', 'utf8')
  );
}

/**
 * Main webhook handler
 */
async function handleWebhook(req, res) {
  const { shop, topic } = req.params;
  const hmac = req.get('X-Shopify-Hmac-Sha256');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📬 SHOPIFY WEBHOOK RECEIVED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Topic:', topic);
  console.log('Shop:', shop);
  console.log('Time:', new Date().toISOString());

  // ✅ Always verify webhook
  if (!verifyWebhook(req.rawBody, hmac)) {
    console.log('❌ Webhook verification failed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return res.status(401).json({ error: 'Webhook verification failed' });
  }
  console.log('✅ Webhook verified');

  // ✅ Respond immediately
  res.status(200).send('Webhook queued');

  try {
    const shopDomain = shop.toLowerCase();
    const store = await db.getStoreByDomain(shopDomain);

    if (!store) {
      console.log('❌ Store not found:', shopDomain);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    console.log('✅ Store found:', store.store_identifier);

    await db.updateStoreSettings(store.id, {
      last_webhook_at: new Date()
    });

    const priority = ['orders/create', 'customers/create'].includes(topic) ? 'high' : 'normal';
    await queueManager.queueWebhook(store, topic, req.body, priority);

    console.log('✅ Webhook queued for processing');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Webhook queueing error:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

module.exports = {
  rawBodyMiddleware,
  handleWebhook,
  verifyWebhook
};