// /**
//  * POST /api/email/send
//  * Manual agent-triggered email using the same branded template as offline notifications.
//  */

// const express = require('express');
// const router = express.Router();

// const FALLBACK_FROM_ADDRESS = 'support@pepscustomercare.com';
// const FALLBACK_BRAND_COLOR  = '#1a5632';

// // ── Auth middleware assumed to be applied at app level ──

// router.post('/send', async (req, res) => {
//   const { to, subject, body, conversationId, customerName } = req.body;

//   if (!to || !subject || !body) {
//     return res.status(400).json({ error: 'to, subject, and body are required' });
//   }

//   try {
//     const pool = req.app.locals.pool; // adjust if you pass pool differently

//     // Pull store branding if conversationId provided
//     let brandName       = 'Support';
//     let brandColor      = FALLBACK_BRAND_COLOR;
//     let fromAddress     = FALLBACK_FROM_ADDRESS;
//     let storeDomain     = '';
//     let resolvedName    = customerName || '';

//     if (conversationId) {
//       const convResult = await pool.query(
//         `SELECT
//            c.customer_name,
//            s.brand_name,
//            s.shop_domain,
//            s.primary_color,
//            s.email_from_address,
//            s.email_brand_color
//          FROM conversations c
//          JOIN stores s ON c.shop_id = s.id
//          WHERE c.id = $1`,
//         [conversationId]
//       );

//       if (convResult.rows.length) {
//         const row = convResult.rows[0];
//         brandName    = row.brand_name      || brandName;
//         brandColor   = row.email_brand_color || row.primary_color || brandColor;
//         fromAddress  = row.email_from_address || fromAddress;
//         storeDomain  = (row.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
//         resolvedName = resolvedName || row.customer_name || '';
//       }
//     }

//     const agentName = req.employee?.name || req.employee?.email || 'Support Team';

//     // Build message in the same shape sendOfflineEmail uses
//     const messages = [{
//       sender_name: agentName,
//       content: body,
//       timestamp: new Date().toISOString(),
//     }];

//     const emailHtml = buildEmailHtml({
//       brandName,
//       customerName: resolvedName,
//       agentName,
//       messages,
//       conversationId,
//       storeDomain,
//       brandColor,
//       customSubject: subject,   // passed through for context, not rendered differently
//     });

//     const plainText = buildPlainText({
//       brandName,
//       customerName: resolvedName,
//       agentName,
//       messages,
//       replyUrl: storeDomain ? `https://${storeDomain}` : '#',
//     });

//     const apiKey = process.env.RESEND_API_KEY;
//     if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

//     const resendRes = await fetch('https://api.resend.com/emails', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${apiKey}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         from: `${brandName} <${fromAddress}>`,
//         to:   [to],
//         subject,
//         html: emailHtml,
//         text: plainText,
//       }),
//     });

//     const resendBody = await resendRes.json();

//     if (!resendRes.ok) {
//       console.error('[Email/send] Resend error:', resendBody);
//       return res.status(502).json({ error: resendBody?.message || 'Failed to send email' });
//     }

//     console.log(`[Email/send] ✅ Sent to ${to} (Resend: ${resendBody.id}) — conv ${conversationId}`);
//     return res.json({ ok: true, id: resendBody.id });

//   } catch (err) {
//     console.error('[Email/send] Error:', err);
//     return res.status(500).json({ error: err.message || 'Internal server error' });
//   }
// });

// module.exports = router;

// // ─────────────────────────────────────────────────────────────
// // HTML TEMPLATE  (mirrors offline email service exactly)
// // ─────────────────────────────────────────────────────────────

// function buildEmailHtml({ brandName, customerName, agentName, messages, storeDomain, brandColor }) {
//   const greeting  = customerName ? `Hi ${esc(customerName)},` : 'Hi there,';
//   const replyUrl  = storeDomain ? `https://${storeDomain}` : '#';
//   const color     = brandColor || FALLBACK_BRAND_COLOR;
//   const year      = new Date().getFullYear();

//   const messageCount = messages.length;
//   const introText = messageCount === 1
//     ? `You have a new message from <strong>${esc(agentName || 'our support team')}</strong> at <strong>${esc(brandName)}</strong>.`
//     : `You have <strong>${messageCount} new messages</strong> from <strong>${esc(agentName || 'our support team')}</strong> at <strong>${esc(brandName)}</strong>.`;

//   const messagesHtml = messages.map((msg, i) => {
//     const time = new Date(msg.timestamp).toLocaleString('en-US', {
//       month: 'short', day: 'numeric', year: 'numeric',
//       hour: 'numeric', minute: '2-digit',
//     });
//     return `
//     <tr>
//       <td style="padding: 0 0 ${i < messages.length - 1 ? '16px' : '0'} 0;">
//         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
//           <tr>
//             <td style="padding-bottom: 6px;">
//               <span style="font-size: 13px; font-weight: 600; color: #212326;">${esc(msg.sender_name || 'Support Agent')}</span>
//               <span style="font-size: 12px; color: #8c9196; margin-left: 8px;">${time}</span>
//             </td>
//           </tr>
//           <tr>
//             <td style="background: #f6f6f7; border-radius: 6px; padding: 14px 16px; font-size: 14px; color: #202223; line-height: 1.6; white-space: pre-wrap; border: 1px solid #e1e3e5;">${esc(msg.content)}</td>
//           </tr>
//         </table>
//       </td>
//     </tr>`;
//   }).join('');

//   return `<!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="utf-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <meta http-equiv="X-UA-Compatible" content="IE=edge" />
//   <title>Message from ${esc(brandName)}</title>
// </head>
// <body style="margin:0;padding:0;background-color:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

//   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f7;">
//     <tr>
//       <td align="center" style="padding: 40px 16px 24px;">
//         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

//           <!-- TOP LOGO BAR -->
//           <tr>
//             <td align="left" style="padding-bottom: 24px;">
//               <table role="presentation" cellpadding="0" cellspacing="0">
//                 <tr>
//                   <td style="vertical-align: middle; padding-right: 10px;">
//                     <img src="https://chatsupportpullzone.b-cdn.net/uploads/shopify_logo-removebg-preview.png"
//                          width="100" height="auto" alt="Shopify"
//                          style="display:block;border:0;outline:none;text-decoration:none;" />
//                   </td>
//                   <td style="vertical-align: middle;">
//                     <span style="font-size: 16px; font-weight: 600; color: #202223;">${esc(brandName)}</span>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <!-- MAIN CARD -->
//           <tr>
//             <td style="background:#ffffff;border-radius:8px;border:1px solid #e1e3e5;overflow:hidden;">

//               <!-- Accent bar -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
//                 <tr><td style="height:4px;background:${color};border-radius:8px 8px 0 0;"></td></tr>
//               </table>

//               <!-- Card body -->
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
//                 <tr>
//                   <td style="padding: 32px 36px 28px;">

//                     <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#202223;letter-spacing:-0.3px;">
//                       You have a new message
//                     </h1>
//                     <p style="margin:0 0 24px 0;font-size:14px;color:#6d7175;line-height:1.5;">
//                       ${greeting} ${introText}
//                     </p>

//                     <!-- Divider -->
//                     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
//                       <tr><td style="height:1px;background:#e1e3e5;"></td></tr>
//                     </table>

//                     <!-- Messages -->
//                     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
//                       ${messagesHtml}
//                     </table>

//                     <!-- Divider -->
//                     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;margin-bottom:28px;">
//                       <tr><td style="height:1px;background:#e1e3e5;"></td></tr>
//                     </table>

//                     <!-- CTA -->
//                     <table role="presentation" cellpadding="0" cellspacing="0">
//                       <tr>
//                         <td style="border-radius:6px;background:${color};">
//                           <a href="${replyUrl}"
//                              style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.1px;">
//                             Reply to this message
//                           </a>
//                         </td>
//                       </tr>
//                     </table>

//                     <p style="margin:16px 0 0 0;font-size:13px;color:#8c9196;">
//                       Or copy and paste this URL into your browser:
//                       <a href="${replyUrl}" style="color:${color};word-break:break-all;">${replyUrl}</a>
//                     </p>

//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <!-- FOOTER -->
//           <tr>
//             <td style="padding: 24px 0 0 0;">
//               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

//                 <tr>
//                   <td align="center" style="padding-bottom:12px;">
//                     <table role="presentation" cellpadding="0" cellspacing="0">
//                       <tr>
//                         <td style="vertical-align:middle;padding-right:6px;">
//                           <img src="https://chatsupportpullzone.b-cdn.net/uploads/shopify_logo-removebg-preview.png"
//                                width="48" height="auto" alt="Shopify"
//                                style="display:block;opacity:0.6;border:0;outline:none;text-decoration:none;" />
//                         </td>
//                         <td style="vertical-align:middle;">
//                           <span style="font-size:12px;color:#8c9196;">Powered by <strong style="color:#6d7175;">Shopify</strong></span>
//                         </td>
//                       </tr>
//                     </table>
//                   </td>
//                 </tr>

//                 <tr>
//                   <td align="center">
//                     <p style="margin:0 0 4px 0;font-size:12px;color:#8c9196;line-height:1.5;">
//                       You received this email because a support agent sent you a message from
//                       <a href="${replyUrl}" style="color:#8c9196;text-decoration:underline;">${esc(storeDomain || brandName)}</a>.
//                     </p>
//                   </td>
//                 </tr>

//                 <tr>
//                   <td align="center" style="padding-top:12px;">
//                     <p style="margin:0;font-size:11px;color:#babec3;">
//                       &copy; ${year} ${esc(brandName)}${storeDomain ? ` &middot; <a href="https://${esc(storeDomain)}" style="color:#babec3;text-decoration:underline;">${esc(storeDomain)}</a>` : ''}
//                     </p>
//                   </td>
//                 </tr>

//               </table>
//             </td>
//           </tr>

//         </table>
//       </td>
//     </tr>
//   </table>

// </body>
// </html>`;
// }

// function buildPlainText({ brandName, customerName, agentName, messages, replyUrl }) {
//   const greeting = customerName ? `Hi ${customerName},` : 'Hi there,';
//   const msgText  = messages.map(msg => {
//     const time = new Date(msg.timestamp).toLocaleString('en-US', {
//       month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
//     });
//     return `${msg.sender_name || 'Support Agent'} (${time}):\n${msg.content}`;
//   }).join('\n\n');

//   return `${greeting}

// You have a new message from ${agentName || 'our team'} at ${brandName}:

// ${msgText}

// Continue here: ${replyUrl}

// ---
// Sent by a support agent at ${brandName}.
// Powered by Shopify`;
// }

// function esc(text) {
//   if (!text) return '';
//   return String(text)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&#39;');
// }




const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const COOLDOWN_HOURS      = parseInt(process.env.EMAIL_COOLDOWN_HOURS   || '1',      10);
const COOLDOWN_MS         = COOLDOWN_HOURS * 60 * 60 * 1000;
const DEBOUNCE_MS         = parseInt(process.env.EMAIL_DEBOUNCE_MS      || '30000',  10);
const SWEEP_INTERVAL_MS   = parseInt(process.env.EMAIL_SWEEP_INTERVAL_MS || '300000', 10);
const HEARTBEAT_STALE_MS  = 90000;

const FALLBACK_FROM_ADDRESS = 'support@pepshelp.com';
const FALLBACK_BRAND_COLOR  = '#1a5632';

const pendingSends = new Map();
let sweepTimer = null;

// ──────────────────────────────────────────────
// REAL-TIME: Called after every agent message
// ──────────────────────────────────────────────

async function handleOfflineEmailNotification(pool, message) {
  const { conversation_id, sender_name, sender_type, id: messageId } = message;

  if (sender_type !== 'agent') return;

  try {
    const presence = await pool.query(
      `SELECT status, last_activity_at, last_heartbeat_at, ws_connected, customer_email
       FROM customer_presence
       WHERE conversation_id = $1`,
      [conversation_id]
    );

    const customer = presence.rows.length ? presence.rows[0] : null;

    if (customer && isCustomerOnline(customer)) {
      console.log(`[Email] Customer online for conv ${conversation_id}, skipping`);
      return;
    }

    if (!customer) {
      console.log(`[Email] No presence row for conv ${conversation_id}, treating as offline`);
    }

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

    if (pendingSends.has(conversation_id)) {
      console.log(`[Email] Debounce active for conv ${conversation_id}, message will be included in pending send`);
      return;
    }

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
// CORE SEND LOGIC
// ──────────────────────────────────────────────

async function sendOfflineEmail(pool, conversation_id, triggerMessageId) {
  try {
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

    const customerEmail = conv.customer_email || (customer && customer.customer_email);
    if (!customerEmail) {
      console.log(`[Email] No customer email for conv ${conversation_id}, skipping`);
      return;
    }

    const emailFromName    = conv.brand_name;
    const emailFromAddress = conv.email_from_address || FALLBACK_FROM_ADDRESS;
    const brandColor       = conv.email_brand_color  || conv.primary_color || FALLBACK_BRAND_COLOR;
    const storeDomain      = (conv.shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    const lastEmailedMsg = await pool.query(
      `SELECT m.timestamp AS last_msg_timestamp
       FROM offline_email_log oel
       JOIN messages m ON m.id = oel.message_id
       WHERE oel.conversation_id = $1
       ORDER BY oel.sent_at DESC LIMIT 1`,
      [conversation_id]
    );

    let sinceTimestamp = '1970-01-01T00:00:00Z';

    if (lastEmailedMsg.rows.length) {
      sinceTimestamp = lastEmailedMsg.rows[0].last_msg_timestamp;
    }

    if (customer && customer.last_activity_at) {
      const lastActivity = new Date(customer.last_activity_at);
      if (lastActivity > new Date(sinceTimestamp)) {
        sinceTimestamp = customer.last_activity_at;
      }
    }

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

    const latestAgentName = unreadMessages[unreadMessages.length - 1].sender_name || 'Support';
    const lastMessageId   = unreadMessages[unreadMessages.length - 1].id;

    const emailHtml = buildEmailHtml({
      brandName:    emailFromName,
      customerName: conv.customer_name,
      agentName:    latestAgentName,
      messages:     unreadMessages,
      conversationId: conversation_id,
      storeDomain,
      brandColor,
    });

    const plainText = buildPlainText({
      brandName:    emailFromName,
      customerName: conv.customer_name,
      agentName:    latestAgentName,
      messages:     unreadMessages,
      replyUrl:     `https://${storeDomain}`,
    });

    const { data, error } = await resend.emails.send({
      from:    `${emailFromName} <${emailFromAddress}>`,
      to:      [customerEmail],
      subject: `${latestAgentName} replied to your message – ${emailFromName}`,
      html:    emailHtml,
      text:    plainText,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return;
    }

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
// SWEEP: Safety net every 5 minutes
// ──────────────────────────────────────────────

function startEmailSweep(pool) {
  console.log(`[Email Sweep] Started — checking every ${SWEEP_INTERVAL_MS / 1000}s`);
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
    const result = await pool.query(`
      WITH last_emailed AS (
        SELECT
          oel.conversation_id,
          MAX(m.timestamp)  AS last_emailed_timestamp,
          MAX(oel.sent_at)  AS last_email_sent_at
        FROM offline_email_log oel
        JOIN messages m ON m.id = oel.message_id
        GROUP BY oel.conversation_id
      )
      SELECT DISTINCT c.id AS conversation_id
      FROM conversations c
      LEFT JOIN last_emailed le  ON le.conversation_id  = c.id
      LEFT JOIN customer_presence cp ON cp.conversation_id = c.id
      JOIN messages m ON m.conversation_id = c.id
        AND m.sender_type = 'agent'
        AND (le.last_emailed_timestamp IS NULL OR m.timestamp > le.last_emailed_timestamp)
      WHERE c.customer_email IS NOT NULL
        AND (
          cp.conversation_id IS NULL
          OR cp.status != 'online'
          OR cp.ws_connected = false
          OR cp.last_heartbeat_at < NOW() - INTERVAL '90 seconds'
        )
        AND (
          le.last_email_sent_at IS NULL
          OR le.last_email_sent_at < NOW() - INTERVAL '${COOLDOWN_HOURS} hours'
        )
      ORDER BY c.id
    `);

    if (!result.rows.length) return;

    console.log(`[Email Sweep] Found ${result.rows.length} conversation(s) with unsent messages`);

    for (const row of result.rows) {
      if (pendingSends.has(row.conversation_id)) continue;
      try {
        await sendOfflineEmail(pool, row.conversation_id, null);
      } catch (err) {
        console.error(`[Email Sweep] Error for conv ${row.conversation_id}:`, err);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (err) {
    console.error('[Email Sweep] runSweep error:', err);
  }
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function isCustomerOnline(customer) {
  if (!customer) return false;
  const now           = Date.now();
  const lastHeartbeat = new Date(customer.last_heartbeat_at).getTime();
  return (
    customer.status === 'online' &&
    customer.ws_connected &&
    (now - lastHeartbeat) < HEARTBEAT_STALE_MS
  );
}

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
  const replyUrl = storeDomain ? `https://${storeDomain}` : '#';
  const color    = brandColor || FALLBACK_BRAND_COLOR;

  const initials = (brandName || 'S')
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');

  const messageCount = messages.length;
  const subheading   = messageCount === 1
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
                &copy; ${new Date().getFullYear()} ${esc(brandName)}${storeDomain ? ` &middot; <a href="https://${esc(storeDomain)}" style="color: #a0aec0; text-decoration: underline;">${esc(storeDomain)}</a>` : ''}
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
  const msgText  = messages.map(msg => {
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