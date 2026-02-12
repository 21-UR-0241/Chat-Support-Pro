

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const COOLDOWN_HOURS = parseInt(process.env.EMAIL_COOLDOWN_HOURS || '1', 10);
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000; // 1 hour default
const DEBOUNCE_MS = parseInt(process.env.EMAIL_DEBOUNCE_MS || '30000', 10); // 30s debounce to batch messages
const SWEEP_INTERVAL_MS = parseInt(process.env.EMAIL_SWEEP_INTERVAL_MS || '300000', 10); // 5 min safety net
const HEARTBEAT_STALE_MS = 90000; // 90 seconds — customer considered offline if heartbeat older than this

// Fallbacks if database has no values
const FALLBACK_FROM_ADDRESS = 'support@pepshelp.com';
const FALLBACK_BRAND_COLOR = '#1a5632';

// In-memory lock to prevent overlapping debounced sends for the same conversation
const pendingSends = new Map();
let sweepTimer = null;

// ──────────────────────────────────────────────
// REAL-TIME: Called after every agent message
// ──────────────────────────────────────────────

/**
 * Called after every agent message is saved.
 * Checks if customer is offline, then queues email notification via Resend.
 *
 * @param {object} pool - pg Pool instance
 * @param {object} message - saved message row from saveMessage()
 *
 * Integration (server.js):
 *   const { handleOfflineEmailNotification, startEmailSweep } = require('./services/emailService');
 *
 *   // On server start:
 *   startEmailSweep(pool);
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
    //    If no presence row exists, treat customer as OFFLINE (not skip!)
    const presence = await pool.query(
      `SELECT status, last_activity_at, last_heartbeat_at, ws_connected, customer_email
       FROM customer_presence
       WHERE conversation_id = $1`,
      [conversation_id]
    );

    const customer = presence.rows.length ? presence.rows[0] : null;

    // 2. Is customer actively online?
    if (customer && isCustomerOnline(customer)) {
      console.log(`[Email] Customer online for conv ${conversation_id}, skipping`);
      return;
    }

    // If no presence row, log it but continue (customer is assumed offline)
    if (!customer) {
      console.log(`[Email] No presence row for conv ${conversation_id}, treating as offline`);
    }

    // 3. Check cooldown (max 1 email per hour per conversation)
    const lastEmail = await pool.query(
      `SELECT sent_at FROM offline_email_log
       WHERE conversation_id = $1
       ORDER BY sent_at DESC LIMIT 1`,
      [conversation_id]
    );

    if (lastEmail.rows.length) {
      const timeSinceLast = Date.now() - new Date(lastEmail.rows[0].sent_at).getTime();
      if (timeSinceLast < COOLDOWN_MS) {
        console.log(`[Email] Cooldown active for conv ${conversation_id}, skipping`);
        return;
      }
    }

    // 4. Debounce: if a send is already pending for this conversation, skip.
    //    The pending send will pick up all messages when it fires.
    if (pendingSends.has(conversation_id)) {
      console.log(`[Email] Debounce active for conv ${conversation_id}, message will be included in pending send`);
      return;
    }

    // Mark this conversation as having a pending send
    const timeout = setTimeout(async () => {
      pendingSends.delete(conversation_id);
      try {
        await sendOfflineEmail(pool, conversation_id, messageId);
      } catch (err) {
        console.error(`[Email] Debounced send error for conv ${conversation_id}:`, err);
      }
    }, DEBOUNCE_MS);

    pendingSends.set(conversation_id, timeout);
    console.log(`[Email] Debounce started for conv ${conversation_id}, sending in ${DEBOUNCE_MS / 1000}s`);

  } catch (err) {
    console.error('[Email] handleOfflineEmailNotification error:', err);
  }
}

// ──────────────────────────────────────────────
// CORE SEND LOGIC (used by real-time + sweep)
// ──────────────────────────────────────────────

/**
 * Actually builds and sends the email.
 * Re-checks online status and gathers ALL unsent messages.
 * Used by both real-time debounce and the sweep safety net.
 */
async function sendOfflineEmail(pool, conversation_id, triggerMessageId) {
  try {
    // 1. Re-check customer presence (they may have come back during debounce)
    const presence = await pool.query(
      `SELECT status, last_activity_at, last_heartbeat_at, ws_connected, customer_email
       FROM customer_presence
       WHERE conversation_id = $1`,
      [conversation_id]
    );

    const customer = presence.rows.length ? presence.rows[0] : null;

    if (customer && isCustomerOnline(customer)) {
      console.log(`[Email] Customer came back online for conv ${conversation_id}, skipping`);
      return;
    }

    // 2. Re-check cooldown
    const lastEmail = await pool.query(
      `SELECT sent_at FROM offline_email_log
       WHERE conversation_id = $1
       ORDER BY sent_at DESC LIMIT 1`,
      [conversation_id]
    );

    if (lastEmail.rows.length) {
      const timeSinceLast = Date.now() - new Date(lastEmail.rows[0].sent_at).getTime();
      if (timeSinceLast < COOLDOWN_MS) {
        console.log(`[Email] Cooldown active (pre-send) for conv ${conversation_id}, skipping`);
        return;
      }
    }

    // 3. Get conversation + store email config
    //    Get customer_email from conversations table (reliable source)
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

    // Use email from conversations table, fallback to presence table
    const customerEmail = conv.customer_email || (customer && customer.customer_email);
    if (!customerEmail) {
      console.log(`[Email] No customer email for conv ${conversation_id}, skipping`);
      return;
    }

    // Email config
    const emailFromName    = conv.brand_name;
    const emailFromAddress = conv.email_from_address || FALLBACK_FROM_ADDRESS;
    const brandColor       = conv.email_brand_color  || conv.primary_color || FALLBACK_BRAND_COLOR;
    const storeDomain      = (conv.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    // 4. Determine the cutoff: use the last message we already emailed about
    //    Don't rely on last_activity_at alone, use email log as source of truth
    const lastEmailedMsg = await pool.query(
      `SELECT m.timestamp AS last_msg_timestamp
       FROM offline_email_log oel
       JOIN messages m ON m.id = oel.message_id
       WHERE oel.conversation_id = $1
       ORDER BY oel.sent_at DESC LIMIT 1`,
      [conversation_id]
    );

    // If we've emailed before, get messages after the last emailed one.
    // If never emailed, get ALL agent messages in this conversation.
    let sinceTimestamp = '1970-01-01T00:00:00Z';

    if (lastEmailedMsg.rows.length) {
      sinceTimestamp = lastEmailedMsg.rows[0].last_msg_timestamp;
    }

    // Also consider last_activity_at if it's more recent (customer was active after last email)
    if (customer && customer.last_activity_at) {
      const lastActivity = new Date(customer.last_activity_at);
      if (lastActivity > new Date(sinceTimestamp)) {
        sinceTimestamp = customer.last_activity_at;
      }
    }

    // 5. Get ALL unread agent messages since the cutoff
    const unreadResult = await pool.query(
      `SELECT id, content, sender_name, timestamp
       FROM messages
       WHERE conversation_id = $1
         AND sender_type = 'agent'
         AND timestamp > $2
       ORDER BY timestamp ASC`,
      [conversation_id, sinceTimestamp]
    );

    const unreadMessages = unreadResult.rows;
    if (!unreadMessages.length) return;

    // Use the latest agent name for the subject line
    const latestAgentName = unreadMessages[unreadMessages.length - 1].sender_name || 'Support';
    const lastMessageId = unreadMessages[unreadMessages.length - 1].id;

    // 6. Build and send email
    const emailHtml = buildEmailHtml({
      brandName: emailFromName,
      customerName: conv.customer_name,
      agentName: latestAgentName,
      messages: unreadMessages,
      conversationId: conversation_id,
      storeDomain,
      brandColor,
    });

    const plainText = buildPlainText({
      brandName: emailFromName,
      customerName: conv.customer_name,
      agentName: latestAgentName,
      messages: unreadMessages,
      replyUrl: `https://${storeDomain}`,
    });

    const { data, error } = await resend.emails.send({
      from: `${emailFromName} <${emailFromAddress}>`,
      to: [customerEmail],
      subject: `${latestAgentName} replied to your message – ${emailFromName}`,
      html: emailHtml,
      text: plainText,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return;
    }

    // 7. Log using the LAST message in the batch as the reference
    await pool.query(
      `INSERT INTO offline_email_log (conversation_id, message_id, customer_email, resend_id)
       VALUES ($1, $2, $3, $4)`,
      [conversation_id, lastMessageId, customerEmail, data?.id || null]
    );

    console.log(`[Email] ✅ Sent ${unreadMessages.length} message(s) to ${customerEmail} for conv ${conversation_id} (Resend: ${data?.id})`);

  } catch (err) {
    console.error('[Email] sendOfflineEmail error:', err);
  }
}

// ──────────────────────────────────────────────
// SWEEP: Safety net that runs every 5 minutes
// ──────────────────────────────────────────────

/**
 * Start the periodic email sweep. Call once on server startup.
 * Catches any emails missed by the real-time handler (e.g. server restarts,
 * missing presence rows, WebSocket issues).
 *
 * Integration (server.js):
 *   const { startEmailSweep, stopEmailSweep } = require('./services/emailService');
 *   startEmailSweep(pool);
 *
 *   // On graceful shutdown:
 *   stopEmailSweep();
 */
function startEmailSweep(pool) {
  console.log(`[Email Sweep] Started — checking every ${SWEEP_INTERVAL_MS / 1000}s`);

  // First sweep after a short delay (let server finish starting)
  setTimeout(() => runSweep(pool), 10000);
  sweepTimer = setInterval(() => runSweep(pool), SWEEP_INTERVAL_MS);
}

function stopEmailSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    console.log('[Email Sweep] Stopped');
  }
}

async function runSweep(pool) {
  try {
    // Find all conversations with unsent agent messages where customer is offline
    const result = await pool.query(`
      WITH last_emailed AS (
        SELECT 
          oel.conversation_id,
          MAX(m.timestamp) AS last_emailed_timestamp,
          MAX(oel.sent_at) AS last_email_sent_at
        FROM offline_email_log oel
        JOIN messages m ON m.id = oel.message_id
        GROUP BY oel.conversation_id
      )
      SELECT DISTINCT c.id AS conversation_id
      FROM conversations c
      LEFT JOIN last_emailed le ON le.conversation_id = c.id
      LEFT JOIN customer_presence cp ON cp.conversation_id = c.id
      JOIN messages m ON m.conversation_id = c.id
        AND m.sender_type = 'agent'
        AND (le.last_emailed_timestamp IS NULL OR m.timestamp > le.last_emailed_timestamp)
      WHERE c.customer_email IS NOT NULL
        -- Customer is NOT online (no presence row, or offline, or stale heartbeat)
        AND (
          cp.conversation_id IS NULL
          OR cp.status != 'online'
          OR cp.ws_connected = false
          OR cp.last_heartbeat_at < NOW() - INTERVAL '90 seconds'
        )
        -- Respect cooldown: no email sent in the last cooldown period
        AND (
          le.last_email_sent_at IS NULL
          OR le.last_email_sent_at < NOW() - INTERVAL '${COOLDOWN_HOURS} hours'
        )
      ORDER BY c.id
    `);

    if (!result.rows.length) return;

    console.log(`[Email Sweep] Found ${result.rows.length} conversation(s) with unsent messages`);

    for (const row of result.rows) {
      // Skip if there's already a pending debounced send
      if (pendingSends.has(row.conversation_id)) continue;

      try {
        await sendOfflineEmail(pool, row.conversation_id, null);
      } catch (err) {
        console.error(`[Email Sweep] Error for conv ${row.conversation_id}:`, err);
      }

      // Rate limit between sends
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (err) {
    console.error('[Email Sweep] runSweep error:', err);
  }
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

/**
 * Check if customer is currently online based on presence data.
 */
function isCustomerOnline(customer) {
  if (!customer) return false;
  const now = Date.now();
  const lastHeartbeat = new Date(customer.last_heartbeat_at).getTime();
  return (
    customer.status === 'online' &&
    customer.ws_connected &&
    (now - lastHeartbeat) < HEARTBEAT_STALE_MS
  );
}

/**
 * Cancel any pending debounced email for a conversation.
 * Call this when a customer comes back online to avoid unnecessary emails.
 *
 * Integration (server.js):
 *   const { cancelPendingEmail } = require('./services/emailService');
 *
 *   // When customer reconnects or sends a message:
 *   cancelPendingEmail(conversation_id);
 */
function cancelPendingEmail(conversation_id) {
  if (pendingSends.has(conversation_id)) {
    clearTimeout(pendingSends.get(conversation_id));
    pendingSends.delete(conversation_id);
    console.log(`[Email] Cancelled pending email for conv ${conversation_id} (customer returned)`);
  }
}

// ──────────────────────────────────────────────
// HTML EMAIL TEMPLATE
// ──────────────────────────────────────────────

function buildEmailHtml({ brandName, customerName, agentName, messages, conversationId, storeDomain, brandColor }) {
  const greeting = customerName ? `Hi ${esc(customerName)},` : 'Hi there,';
  const replyUrl = `https://${storeDomain}`;
  const color = brandColor || FALLBACK_BRAND_COLOR;

  const initials = brandName
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');

  const messageCount = messages.length;
  const subheading = messageCount === 1
    ? `You have a new message in your conversation with <strong>${esc(brandName)}</strong>.`
    : `You have <strong>${messageCount} new messages</strong> in your conversation with <strong>${esc(brandName)}</strong>.`;

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
                      ${greeting} ${subheading}
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

You have ${messages.length} new message${messages.length > 1 ? 's' : ''} from ${agentName || 'our team'} at ${brandName}:

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

module.exports = {
  handleOfflineEmailNotification,
  cancelPendingEmail,
  startEmailSweep,
  stopEmailSweep,
};
