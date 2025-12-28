/**
 * Shopify Webhooks Handler
 */

const crypto = require('crypto');

function verifyWebhook(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return hmac === hash;
}

async function handleWebhook(req, res) {
  const { storeIdentifier, topic } = req.params;

  console.log(`Webhook received: ${topic} for store ${storeIdentifier}`);

  // Verify webhook (optional in development)
  if (process.env.NODE_ENV === 'production') {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ error: 'Webhook verification failed' });
    }
  }

  try {
    switch (topic) {
      case 'app-uninstalled':
        console.log(`App uninstalled from ${storeIdentifier}`);
        // Handle app uninstall
        break;

      case 'customers-create':
      case 'customers-update':
        console.log(`Customer updated in ${storeIdentifier}`);
        break;

      case 'orders-create':
      case 'orders-updated':
        console.log(`Order updated in ${storeIdentifier}`);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = {
  handleWebhook,
  verifyWebhook
};