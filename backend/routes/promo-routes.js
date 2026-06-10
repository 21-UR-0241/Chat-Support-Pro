// routes/promo-routes.js
// Mount in server.js:
//   const promoRoutes = require('./routes/promo-routes');
//   app.use('/api/promo', promoRoutes);
//
// Endpoints:
//   GET  /api/promo/recipients?storeIds=all   (admin) → purchasers to email
//   GET  /api/promo/recipients?storeIds=1,2,3 (admin)
//   POST /api/promo/send                      (admin) → fires blast via Resend
//   POST /api/promo/record-sent               (admin) → records sent emails to DB
//   GET  /api/promo/sent                      (admin) → list all sent emails
//   GET  /api/promo/unsubscribe?e=..&t=..     (public) → one-click opt-out

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../database');
const { authenticateToken } = require('../auth');

const FALLBACK_FROM_EMAIL = 'support@pepscustomercare.com';
const FALLBACK_FROM_NAME  = 'Customer Support';
const RECIPIENTS_CAP      = 50000;
const SEND_DELAY_MS       = 200; // delay between individual sends — avoids rate limits

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cleanDomain(d) {
  return String(d || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
}

function applyMerge(template, fields) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in fields ? fields[k] : m));
}

function unsubToken(email) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'promo-fallback-secret')
    .update(String(email).toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
}

function buildUnsubscribeUrl(email) {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '');
  const e    = encodeURIComponent(String(email).toLowerCase().trim());
  return `${base}/api/promo/unsubscribe?e=${e}&t=${unsubToken(email)}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Store email config cache (per domain, reset on each request batch) ────────
// Fetches the store's own from-address so emails come from the recognised
// store domain — same pattern as emailService.js which hits inbox reliably.

async function getStoreEmailConfig(storeDomain) {
  if (!storeDomain) return null;
  try {
    const { rows } = await db.pool.query(
      `SELECT email_from_address, email_from_name, brand_name
       FROM stores
       WHERE shop_domain = $1
       LIMIT 1`,
      [storeDomain]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[Promo] getStoreEmailConfig error:', err.message);
    return null;
  }
}

// ── Table bootstrap ───────────────────────────────────────────────────────────

let _promoTablesReady = null;

async function ensurePromoTables() {
  if (!_promoTablesReady) {
    _promoTablesReady = (async () => {
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS promo_unsubscribes (
          id              SERIAL PRIMARY KEY,
          email           TEXT NOT NULL UNIQUE,
          unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS promo_sent_emails (
          id            SERIAL PRIMARY KEY,
          email         TEXT        NOT NULL,
          store_domain  TEXT        NOT NULL DEFAULT '',
          store_name    TEXT,
          discount_code TEXT,
          sent_at       TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Drop old global unique if upgrading from earlier version
      await db.pool.query(`
        ALTER TABLE promo_sent_emails
          DROP CONSTRAINT IF EXISTS promo_sent_emails_email_key
      `).catch(() => {});

      // Composite unique: one send per (email, store_domain)
      await db.pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS promo_sent_emails_email_store_uidx
          ON promo_sent_emails (LOWER(email), store_domain)
      `);
    })().catch((err) => {
      _promoTablesReady = null;
      throw err;
    });
  }
  return _promoTablesReady;
}

// ── GET /recipients ───────────────────────────────────────────────────────────
// Returns purchasers excluding:
//   - blacklisted conversations
//   - archived conversations
//   - global unsubscribes
//   - already emailed from this specific store

router.get('/recipients', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await ensurePromoTables();

    const raw   = (req.query.storeIds || 'all').toString();
    const isAll = raw === 'all' || raw === '';
    const ids   = isAll ? [] : raw.split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite);
    if (!isAll && ids.length === 0)
      return res.status(400).json({ error: 'Provide storeIds=all or a comma list of store IDs' });

    const params      = [];
    let   storeFilter = '';
    if (!isAll) {
      params.push(ids);
      storeFilter = `AND c.shop_id = ANY($${params.length})`;
    }

    const { rows } = await db.pool.query(
      `SELECT
         c.customer_email        AS email,
         MAX(c.customer_name)    AS name,
         s2.id                   AS store_id,
         s2.brand_name           AS store_name,
         s2.shop_domain          AS store_domain,
         MAX(c.updated_at)       AS last_seen_at
       FROM conversations c
       JOIN stores s2 ON s2.id = c.shop_id
       WHERE c.customer_email IS NOT NULL
         AND c.customer_email <> ''
         -- Exclude blacklisted and archived
         AND c.status NOT IN ('blacklisted', 'archived')
         -- Exclude global unsubscribes
         AND NOT EXISTS (
           SELECT 1 FROM promo_unsubscribes u
           WHERE LOWER(u.email) = LOWER(c.customer_email)
         )
         -- Exclude already emailed from this specific store
         AND NOT EXISTS (
           SELECT 1 FROM promo_sent_emails ps
           WHERE LOWER(ps.email) = LOWER(c.customer_email)
             AND (
               ps.store_domain = ''
               OR ps.store_domain = s2.shop_domain
             )
         )
         ${storeFilter}
       GROUP BY c.customer_email, s2.id, s2.brand_name, s2.shop_domain
       ORDER BY last_seen_at DESC
       LIMIT $${params.length + 1}`,
      [...params, RECIPIENTS_CAP]
    );

    const recipients = rows.map((r) => {
      const domain = cleanDomain(r.store_domain);
      return {
        email:       r.email,
        name:        r.name      || '',
        storeId:     r.store_id,
        storeName:   r.store_name,
        storeDomain: domain,
        storeUrl:    domain ? `https://${domain}` : '',
        lastOrderAt: r.last_seen_at,
      };
    });

    return res.json(recipients);
  } catch (err) {
    console.error('[Promo/recipients] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load recipients' });
  }
});

// ── POST /send ────────────────────────────────────────────────────────────────
// Deliverability improvements vs the old batch version:
//   1. Sends one email at a time (not /emails/batch) — same pattern as
//      emailService.js which reliably hits inbox
//   2. Uses the store's own email_from_address per recipient — the FROM
//      domain matches what the customer recognises
//   3. Adds List-Unsubscribe + List-Unsubscribe-Post headers — Gmail/Outlook
//      treat these as legitimate bulk mail, not spam
//   4. Adds X-Entity-Ref-ID per email — deduplication hint for mail servers
//   5. 200ms delay between sends — avoids triggering provider rate limits

router.post('/send', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await ensurePromoTables();

    const {
      fromEmail, fromName, subjectTemplate, htmlTemplate,
      textTemplate, recipients, test,
    } = req.body || {};

    if (!subjectTemplate || !htmlTemplate || !Array.isArray(recipients) || recipients.length === 0)
      return res.status(400).json({ error: 'subjectTemplate, htmlTemplate, and a non-empty recipients array are required' });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Email service not configured (missing RESEND_API_KEY)' });

    let sent   = 0;
    let failed = 0;
    const errors = [];

    // Cache store configs so we don't re-query for every email from the same store
    const storeConfigCache = new Map();

    for (const r of recipients) {
      const email = String(r.email || '').trim();
      if (!EMAIL_RE.test(email)) {
        failed++;
        errors.push(`Invalid email: ${email || '(blank)'}`);
        continue;
      }

      const domain = cleanDomain(r.storeDomain || r.storeUrl || '');

      // ── Resolve FROM address: prefer store's own domain ──────────────────
      // This is the key deliverability fix — emails from alconapeptides.ca
      // come FROM alconapeptides.ca, not a generic shared domain.
      let resolvedFrom = `${fromName || FALLBACK_FROM_NAME} <${fromEmail || FALLBACK_FROM_EMAIL}>`;

      if (domain) {
        if (!storeConfigCache.has(domain)) {
          const config = await getStoreEmailConfig(domain);
          storeConfigCache.set(domain, config);
        }
        const storeConfig = storeConfigCache.get(domain);
        if (storeConfig) {
          const storeFromAddress = storeConfig.email_from_address || FALLBACK_FROM_EMAIL;
          const storeFromName    = storeConfig.email_from_name    || storeConfig.brand_name || r.storeName || FALLBACK_FROM_NAME;
          resolvedFrom = `${storeFromName} <${storeFromAddress}>`;
        }
      }

      const unsubscribeUrl = buildUnsubscribeUrl(email);

      const fields = {
        customer_email:  email,
        customer_name:   r.name || email,
        store_name:      r.storeName || domain || 'our store',
        store_url:       r.storeUrl || (domain ? `https://${domain}` : ''),
        store_domain:    domain,
        unsubscribe_url: unsubscribeUrl,
      };

      const msg = {
        from:    resolvedFrom,
        to:      [email],
        subject: applyMerge(subjectTemplate, fields),
        html:    applyMerge(htmlTemplate,    fields),
        // ── Deliverability headers ────────────────────────────────────────
        headers: {
          // One-click unsubscribe — Gmail/Outlook treat this as legitimate bulk
          'List-Unsubscribe':      `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          // Per-email deduplication hint for receiving mail servers
          'X-Entity-Ref-ID':       `promo-${Date.now()}-${Buffer.from(email).toString('base64').slice(0, 12)}`,
        },
      };
      if (textTemplate) msg.text = applyMerge(textTemplate, fields);

      // ── Send individually (not batch) ─────────────────────────────────────
      // /emails/batch is flagged more aggressively by spam filters.
      // Individual sends via /emails match the pattern that hits inbox.
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method:  'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify(msg),
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          failed++;
          errors.push(body?.message || `Resend error ${resp.status} for ${email}`);
        } else {
          sent++;
        }
      } catch (err) {
        failed++;
        errors.push(`${err.message || 'Request failed'} (${email})`);
      }

      // Small delay between sends — avoids triggering Resend rate limits
      // and looks less like a mass blast to receiving mail servers
      if (!test) await sleep(SEND_DELAY_MS);
    }

    console.log(`[Promo/send] ${test ? 'TEST ' : ''}by ${req.user.email}: ${sent} sent, ${failed} failed`);
    return res.json({ sent, failed, errors: errors.slice(0, 50) });
  } catch (err) {
    console.error('[Promo/send] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /record-sent ─────────────────────────────────────────────────────────

router.post('/record-sent', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await ensurePromoTables();

    const { emails, discountCode } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0)
      return res.status(400).json({ error: 'emails array is required' });

    const values = emails
      .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
      .join(',');

    const params = emails.flatMap((e) => [
      String(e.email     || '').toLowerCase().trim(),
      cleanDomain(e.storeDomain || ''),
      e.storeName  || '',
      discountCode || '',
    ]);

    await db.pool.query(
      `INSERT INTO promo_sent_emails (email, store_domain, store_name, discount_code)
       VALUES ${values}
       ON CONFLICT (LOWER(email), store_domain) DO NOTHING`,
      params
    );

    console.log(`[Promo/record-sent] ${emails.length} records by ${req.user.email}`);
    return res.json({ recorded: emails.length });
  } catch (err) {
    console.error('[Promo/record-sent] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /sent ─────────────────────────────────────────────────────────────────

router.get('/sent', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await ensurePromoTables();

    const { rows } = await db.pool.query(
      `SELECT email, store_domain, store_name, discount_code, sent_at
       FROM promo_sent_emails
       ORDER BY sent_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[Promo/sent] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /unsubscribe ──────────────────────────────────────────────────────────

router.get('/unsubscribe', async (req, res) => {
  const page = (title, msg, ok = true) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
<div style="max-width:440px;margin:80px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;text-align:center;">
<div style="font-size:40px;margin-bottom:12px;">${ok ? '✅' : '⚠️'}</div>
<h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${title}</h1>
<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">${msg}</p>
</div></body></html>`;

  try {
    await ensurePromoTables();
    const email = String(req.query.e || '').toLowerCase().trim();
    const token = String(req.query.t || '');

    if (!email || !token)
      return res.status(400).send(page('Invalid link', 'This unsubscribe link is missing information.', false));

    const expected = unsubToken(email);
    const ok =
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    if (!ok)
      return res.status(400).send(page('Invalid link', 'This unsubscribe link could not be verified.', false));

    await db.pool.query(
      `INSERT INTO promo_unsubscribes (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [email]
    );
    return res.send(page('You have been unsubscribed', `${email} will no longer receive promotional emails from us.`));
  } catch (err) {
    console.error('[Promo/unsubscribe] Error:', err.message);
    return res.status(500).send(page('Something went wrong', 'Please try again later.', false));
  }
});

module.exports = router;