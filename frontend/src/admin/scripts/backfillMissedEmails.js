// scripts/backfillMissedEmails.js
// One-time script to find and send emails for agent messages that were never emailed.
//
// Usage (Windows cmd):
//   set DRY_RUN=true && node scripts/backfillMissedEmails.js   ← preview only (default)
//   set DRY_RUN=false && node scripts/backfillMissedEmails.js  ← actually send emails
//
// Requires: RESEND_API_KEY and DATABASE_URL in .env

require('dotenv').config();
const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: true
const FALLBACK_FROM_ADDRESS = 'support@montrealpeptides.ca';
const FALLBACK_BRAND_COLOR = '#1a5632';

async function backfill() {
  console.log(`\n🔍 Backfill Missed Emails ${DRY_RUN ? '(DRY RUN)' : '(LIVE MODE)'}\n`);

  try {
    // Find ALL conversations with agent messages that have NOT been fully emailed.
    // Covers TWO cases:
    //   A) Conversations with NO email log entries at all (never emailed)
    //   B) Conversations with email log entries but newer agent messages after the last emailed one
    const conversations = await pool.query(`
      WITH last_emailed AS (
        SELECT 
          oel.conversation_id,
          MAX(m.timestamp) AS last_emailed_timestamp
        FROM offline_email_log oel
        JOIN messages m ON m.id = oel.message_id
        GROUP BY oel.conversation_id
      )
      SELECT 
        c.id AS conversation_id,
        c.customer_email,
        c.customer_name,
        s.brand_name,
        s.shop_domain,
        s.primary_color,
        s.email_from_address,
        s.email_brand_color,
        le.last_emailed_timestamp,
        COUNT(m.id) AS unsent_count
      FROM conversations c
      JOIN stores s ON c.shop_id = s.id
      LEFT JOIN last_emailed le ON le.conversation_id = c.id
      JOIN messages m ON m.conversation_id = c.id
        AND m.sender_type = 'agent'
        AND (le.last_emailed_timestamp IS NULL OR m.timestamp > le.last_emailed_timestamp)
      WHERE c.customer_email IS NOT NULL
      GROUP BY c.id, c.customer_email, c.customer_name,
               s.brand_name, s.shop_domain, s.primary_color,
               s.email_from_address, s.email_brand_color,
               le.last_emailed_timestamp
      ORDER BY conversation_id
    `);

    if (!conversations.rows.length) {
      console.log('✅ No missed emails found. All conversations are up to date.\n');
      return;
    }

    console.log(`Found ${conversations.rows.length} conversation(s) with unsent messages:\n`);

    let sentCount = 0;
    let errorCount = 0;

    for (const conv of conversations.rows) {
      const {
        conversation_id,
        customer_email,
        customer_name,
        brand_name,
        shop_domain,
        primary_color,
        email_from_address,
        email_brand_color,
        last_emailed_timestamp, // NULL if never emailed
        unsent_count,
      } = conv;

      // Build the cutoff: either the last emailed message timestamp, or the beginning of time
      const cutoff = last_emailed_timestamp || '1970-01-01T00:00:00Z';

      // Get the unsent messages
      const unsentResult = await pool.query(
        `SELECT id, content, sender_name, timestamp
         FROM messages
         WHERE conversation_id = $1
           AND sender_type = 'agent'
           AND timestamp > $2
         ORDER BY timestamp ASC`,
        [conversation_id, cutoff]
      );

      const messages = unsentResult.rows;
      if (!messages.length) continue;

      const latestAgentName = messages[messages.length - 1].sender_name || 'Support';
      const lastMessageId = messages[messages.length - 1].id;

      const emailFromName     = brand_name;
      const emailFromAddress2 = email_from_address || FALLBACK_FROM_ADDRESS;
      const brandColor        = email_brand_color || primary_color || FALLBACK_BRAND_COLOR;
      const storeDomain       = (shop_domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

      const status = last_emailed_timestamp ? 'has prior emails' : 'NEVER emailed';

      console.log(`  📧 Conv ${conversation_id} (${status})`);
      console.log(`     To: ${customer_email} (${customer_name || 'Guest'})`);
      console.log(`     Messages: ${messages.length} unsent`);
      console.log(`     Agent: ${latestAgentName}`);
      messages.forEach((m, i) => {
        const preview = m.content.substring(0, 80).replace(/\n/g, ' ');
        console.log(`       [${i + 1}] ${m.sender_name || 'Agent'}: ${preview}${m.content.length > 80 ? '...' : ''}`);
      });

      if (DRY_RUN) {
        console.log(`     ⏭️  Skipped (dry run)\n`);
        continue;
      }

      // Build and send
      try {
        const emailHtml = buildEmailHtml({
          brandName: emailFromName,
          customerName: customer_name,
          agentName: latestAgentName,
          messages,
          conversationId: conversation_id,
          storeDomain,
          brandColor,
        });

        const plainText = buildPlainText({
          brandName: emailFromName,
          customerName: customer_name,
          agentName: latestAgentName,
          messages,
          replyUrl: `https://${storeDomain}`,
        });

        const { data, error } = await resend.emails.send({
          from: `${emailFromName} <${emailFromAddress2}>`,
          to: [customer_email],
          subject: `${latestAgentName} replied to your message – ${emailFromName}`,
          html: emailHtml,
          text: plainText,
        });

        if (error) {
          console.error(`     ❌ Resend error: ${JSON.stringify(error)}\n`);
          errorCount++;
          continue;
        }

        // Log the last message so future sends pick up from here
        await pool.query(
          `INSERT INTO offline_email_log (conversation_id, message_id, customer_email, resend_id)
           VALUES ($1, $2, $3, $4)`,
          [conversation_id, lastMessageId, customer_email, data?.id || null]
        );

        console.log(`     ✅ Sent! (Resend: ${data?.id})\n`);
        sentCount++;

        // Rate limit: wait 500ms between sends to avoid hitting Resend limits
        await sleep(500);

      } catch (sendErr) {
        console.error(`     ❌ Error: ${sendErr.message}\n`);
        errorCount++;
      }
    }

    console.log(`\n${'─'.repeat(50)}`);
    if (DRY_RUN) {
      console.log(`🔍 DRY RUN complete. ${conversations.rows.length} conversation(s) need backfill.`);
      console.log(`   Run with DRY_RUN=false to send emails.\n`);
    } else {
      console.log(`✅ Backfill complete. Sent: ${sentCount}, Errors: ${errorCount}\n`);
    }

  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await pool.end();
  }
}

// ──────────────────────────────────────────────
// EMAIL TEMPLATES (same as emailService.js)
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
          
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background: ${color}; color: white; width: 44px; height: 44px; line-height: 44px; text-align: center; border-radius: 10px; font-size: 20px; font-weight: 700;">
                ${initials}
              </div>
            </td>
          </tr>

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

          <tr>
            <td align="center" style="padding: 24px 16px 0 16px;">
              <p style="margin: 0; font-size: 12px; color: #a0aec0; line-height: 1.5;">
                Sent because you have an active chat with ${esc(brandName)}.
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
Sent because you have an active chat with ${brandName}.`;
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
backfill();