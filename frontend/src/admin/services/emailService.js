// services/emailService.js
// Offline email notification via Resend
// Install: npm install resend

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ TESTING: Set to 1 hour for production
const COOLDOWN_HOURS = parseInt(process.env.EMAIL_COOLDOWN_HOURS || '1', 10);
const COOLDOWN_MS = 10 * 1000; // ⚠️ TESTING: 10 seconds (production: COOLDOWN_HOURS * 60 * 60 * 1000)

// Fallbacks if database has no values
const FALLBACK_FROM_ADDRESS = 'support@montrealpeptides.ca';
const FALLBACK_BRAND_COLOR = '#1a5632';

/**
 * Called after every agent message is saved.
 * Checks if customer is offline, then sends email notification via Resend.
 *
 * @param {object} pool - pg Pool instance
 * @param {object} message - saved message row from saveMessage()
 *
 * Integration (server.js):
 *   const { handleOfflineEmailNotification } = require('./services/emailService');
 *
 *   // After saveMessage():
 *   if (savedMessage.sender_type === 'agent') {
 *     handleOfflineEmailNotification(pool, savedMessage).catch(err =>
 *       console.error('[Offline Email] Failed:', err)
 *     );
 *   }
 */
async function handleOfflineEmailNotification(pool, message) {
  const { conversation_id, sender_name, sender_type, id: messageId } = message;

  if (sender_type !== 'agent') return;

  try {
    // 1. Check customer presence
    const presence = await pool.query(
      `SELECT status, last_activity_at, last_heartbeat_at, ws_connected, customer_email
       FROM customer_presence
       WHERE conversation_id = $1`,
      [conversation_id]
    );

    if (!presence.rows.length) return;
    const customer = presence.rows[0];

    // 2. Is customer actively online?
    const now = Date.now();
    const lastHeartbeat = new Date(customer.last_heartbeat_at).getTime();
    const isOnline = (
      customer.status === 'online' &&
      customer.ws_connected &&
      (now - lastHeartbeat) < 10000 // ⚠️ TESTING: 10s (production: 90000)
    );

    if (isOnline) {
      console.log(`[Email] Customer online for conv ${conversation_id}, skipping`);
      return;
    }

    // 3. Check cooldown (max 1 email per hour per conversation)
    const lastEmail = await pool.query(
      `SELECT sent_at FROM offline_email_log
       WHERE conversation_id = $1
       ORDER BY sent_at DESC LIMIT 1`,
      [conversation_id]
    );

    if (lastEmail.rows.length) {
      const timeSinceLast = now - new Date(lastEmail.rows[0].sent_at).getTime();
      if (timeSinceLast < COOLDOWN_MS) {
        console.log(`[Email] Cooldown active for conv ${conversation_id}, skipping`);
        return;
      }
    }

    // 4. Get conversation + store email config
    const convResult = await pool.query(
      `SELECT 
         c.id,
         c.customer_email,
         c.customer_name,
         s.brand_name,
         s.shop_domain,
         s.primary_color,
         s.email_from_address,
         s.email_brand_color
       FROM conversations c
       JOIN stores s ON c.shop_id = s.id
       WHERE c.id = $1`,
      [conversation_id]
    );

    if (!convResult.rows.length) return;
    const conv = convResult.rows[0];

    // Email config: brand_name always from DB, fallback address if no per-store domain
    const emailFromName    = conv.brand_name;
    const emailFromAddress = conv.email_from_address || FALLBACK_FROM_ADDRESS;
    const brandColor       = conv.email_brand_color  || conv.primary_color || FALLBACK_BRAND_COLOR;
    const storeDomain      = (conv.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    // 5. Get unread agent messages since customer went inactive
    const unreadResult = await pool.query(
      `SELECT content, sender_name, timestamp
       FROM messages
       WHERE conversation_id = $1
         AND sender_type = 'agent'
         AND timestamp > $2
       ORDER BY timestamp ASC`,
      [conversation_id, customer.last_activity_at]
    );

    const unreadMessages = unreadResult.rows;
    if (!unreadMessages.length) return;

    // 6. Build and send email
    const emailHtml = buildEmailHtml({
      brandName: emailFromName,
      customerName: conv.customer_name,
      agentName: sender_name,
      messages: unreadMessages,
      conversationId: conversation_id,
      storeDomain,
      brandColor,
    });

    // Plain text version (improves deliverability)
    const plainText = buildPlainText({
      brandName: emailFromName,
      customerName: conv.customer_name,
      agentName: sender_name,
      messages: unreadMessages,
      replyUrl: `https://${storeDomain}`,
    });

    const { data, error } = await resend.emails.send({
      from: `${emailFromName} <${emailFromAddress}>`,
      to: [customer.customer_email],
      subject: `${sender_name || 'Support'} replied to your message – ${emailFromName}`,
      html: emailHtml,
      text: plainText,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return;
    }

    // 7. Log to prevent duplicates (message_id UNIQUE constraint)
    await pool.query(
      `INSERT INTO offline_email_log (conversation_id, message_id, customer_email, resend_id)
       VALUES ($1, $2, $3, $4)`,
      [conversation_id, messageId, customer.customer_email, data?.id || null]
    );

    console.log(`[Email] ✅ Sent to ${customer.customer_email} (Resend: ${data?.id})`);

  } catch (err) {
    console.error('[Email] handleOfflineEmailNotification error:', err);
  }
}

// ──────────────────────────────────────────────
// HTML EMAIL TEMPLATE
// ──────────────────────────────────────────────

function buildEmailHtml({ brandName, customerName, agentName, messages, conversationId, storeDomain, brandColor }) {
  const greeting = customerName ? `Hi ${esc(customerName)},` : 'Hi there,';
  const replyUrl = `https://${storeDomain}`;
  const color = brandColor || FALLBACK_BRAND_COLOR;

  // Brand initials (e.g. "Montreal Peptides" → "MP")
  const initials = brandName
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');

  const messagesHtml = messages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return `
      <tr>
        <td style="padding: 0 0 12px 0;">
          <div style="background: #f7fafc; border-radius: 8px; padding: 14px 16px; border-left: 3px solid ${color};">
            <div style="font-weight: 600; font-size: 13px; color: #4a5568; margin-bottom: 6px;">
              ${esc(msg.sender_name || 'Support Agent')}
              <span style="font-weight: 400; color: #a0aec0; margin-left: 8px;">${time}</span>
            </div>
            <div style="font-size: 14px; color: #1a202c; line-height: 1.6; white-space: pre-wrap;">${esc(msg.content)}</div>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f4f8;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
          
          <!-- Brand Icon -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background: ${color}; color: white; width: 44px; height: 44px; line-height: 44px; text-align: center; border-radius: 10px; font-size: 20px; font-weight: 700;">
                ${initials}
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                
                <tr>
                  <td style="padding: 32px 32px 0 32px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #1a202c;">
                      New reply from ${esc(agentName || 'our team')}
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #718096; line-height: 1.5;">
                      ${greeting} You have a new message in your conversation with <strong>${esc(brandName)}</strong>.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${messagesHtml}
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding: 24px 32px 32px 32px;">
                    <a href="${replyUrl}" style="display: inline-block; background: ${color}; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                      Continue Conversation &rarr;
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px 0 16px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #a0aec0; line-height: 1.5;">
                Sent because you have an active chat with ${esc(brandName)}.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                You won't receive another for at least ${COOLDOWN_HOURS} hour${COOLDOWN_HOURS > 1 ? 's' : ''}.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding: 20px 16px 0 16px;">
              <p style="margin: 0; font-size: 11px; color: #cbd5e0;">
                &copy; ${new Date().getFullYear()} ${esc(brandName)} &middot;
                <a href="https://${esc(storeDomain)}" style="color: #a0aec0; text-decoration: underline;">${esc(storeDomain)}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPlainText({ brandName, customerName, agentName, messages, replyUrl }) {
  const greeting = customerName ? `Hi ${customerName},` : 'Hi there,';
  const msgText = messages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return `${msg.sender_name || 'Support Agent'} (${time}):\n${msg.content}`;
  }).join('\n\n');

  return `${greeting}

You have a new message from ${agentName || 'our team'} at ${brandName}:

${msgText}

Continue here: ${replyUrl}

---
Sent because you have an active chat with ${brandName}.
You won't receive another for at least ${COOLDOWN_HOURS} hour${COOLDOWN_HOURS > 1 ? 's' : ''}.`;
}

function esc(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { handleOfflineEmailNotification };