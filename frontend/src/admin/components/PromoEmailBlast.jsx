


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';

const FROM_EMAIL = 'support@pepscustomercare.com';
const FROM_NAME  = 'Customer Support';

// ── Daily cap (localStorage — UI only, DB is authoritative for duplicates) ───
const DAILY_CAP    = 60;
const LS_KEY_DATE  = 'promo_send_date';
const LS_KEY_COUNT = 'promo_send_count';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function loadDailyCount() {
  const date  = localStorage.getItem(LS_KEY_DATE);
  const today = todayStr();
  if (date !== today) {
    localStorage.setItem(LS_KEY_DATE,  today);
    localStorage.setItem(LS_KEY_COUNT, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(LS_KEY_COUNT) || '0', 10);
}

function persistCount(n) {
  localStorage.setItem(LS_KEY_COUNT, String(n));
  localStorage.setItem(LS_KEY_DATE,  todayStr());
}

// ── Email copy ────────────────────────────────────────────────────────────────
const DEFAULT_SUBJECT =
  'Your 10% Discount is Waiting 👀 {{store_url}} is Back & Better Than Ever';

const DEFAULT_BODY =
`Hi {{customer_email}},

First things first, thank you for being part of our valued customers!

Over the past month, we've been heads-down working through some significant issues with our credit card payment processing.

We've completely overhauled our processes, and credit card payments are officially back online, more secure and reliable than ever. We're committed to your satisfaction.

As a token of appreciation for your patience and loyalty, we'd like to offer you an exclusive one-time discount:

{{discount_box}}

Simply apply the code at checkout.

We will also add quite a few free gifts to some of the orders randomly for the following 4 days! Until Sunday evening inclusively.

Our chat system on site is the best place to reach us if you have any questions!

Warm regards,
{{store_url}}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const applyMerge = (text, fields) =>
  String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in fields ? fields[k] : m));

const toParas = (text) =>
  String(text ?? '')
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;line-height:1.65;color:#374151;font-size:15px;">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');

const cleanDomain = (d) =>
  String(d || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();

const normalizeStore = (s) => {
  const domain = cleanDomain(
    s.domain || s.storeDomain || s.store_domain ||
    s.shopDomain || s.shop_domain || s.storeIdentifier || s.store_identifier || ''
  );
  return {
    id:     s.id ?? s.storeId ?? s.store_id ?? s.shopId ?? s.shop_id ?? domain,
    name:   s.name || s.storeName || s.store_name || s.shopName || s.shop_name || domain || 'Unnamed store',
    domain,
  };
};

const normalizeRecipient = (r) => {
  const email       = (r.email || r.customerEmail || r.customer_email || '').trim().toLowerCase();
  const name        = (r.name  || r.customerName  || r.customer_name  || '').trim();
  const storeId     = r.storeId    ?? r.store_id    ?? r.shopId    ?? r.shop_id    ?? null;
  const storeName   = r.storeName  || r.store_name  || r.shopName  || r.shop_name  || '';
  const storeDomain = cleanDomain(
    r.storeDomain || r.store_domain || r.shopDomain || r.shop_domain || r.storeUrl || r.store_url || ''
  );
  const storeUrl    = (r.storeUrl || r.store_url || (storeDomain ? `https://${storeDomain}` : '')).replace(/\/+$/, '');
  const lastOrderAt = r.lastOrderAt || r.last_order_at || r.lastSeenAt || r.last_seen_at || r.createdAt || r.created_at || null;
  const orderCount  = r.orderCount ?? r.order_count ?? null;
  return { email, name, storeId, storeName, storeDomain, storeUrl, lastOrderAt, orderCount };
};

// One row per email — most recent purchase store wins
const dedupeByEmail = (rows) => {
  const map = new Map();
  for (const r of rows) {
    if (!r.email) continue;
    const existing = map.get(r.email);
    if (!existing) { map.set(r.email, r); continue; }
    const a = r.lastOrderAt ? new Date(r.lastOrderAt).getTime() : 0;
    const b = existing.lastOrderAt ? new Date(existing.lastOrderAt).getTime() : 0;
    if (a >= b) map.set(r.email, r);
  }
  return [...map.values()];
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
};

const fmtLongDate = (d) => {
  if (!d) return '';
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return ''; }
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PromoEmailBlast({ onBack }) {
  // Stores
  const [stores,         setStores]         = useState([]);
  const [storesLoading,  setStoresLoading]  = useState(true);
  const [selectedStoreIds, setSelectedStoreIds] = useState(new Set());
  const [allStores,      setAllStores]      = useState(true);

  // Recipients — auto-fetched on mount; re-fetched when store filter changes
  const [recipients,        setRecipients]        = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [excludedEmails,    setExcludedEmails]    = useState(new Set());
  const [search,            setSearch]            = useState('');

  // Daily cap (localStorage)
  const [dailySentCount, setDailySentCount] = useState(0);

  // Discount
  const [discountCode,    setDiscountCode]    = useState('CCBACK10');
  const [discountPercent, setDiscountPercent] = useState(10);
  const [validDays,       setValidDays]       = useState(4);
  const [validUntil,      setValidUntil]      = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  });

  // Copy
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body,    setBody]    = useState(DEFAULT_BODY);

  // UI
  const [tab,         setTab]         = useState('recipients');
  const [previewIdx,  setPreviewIdx]  = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error,       setError]       = useState(null);

  // Test send
  const [testEmail,   setTestEmail]   = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testMsg,     setTestMsg]     = useState(null);

  // Blast send
  const [sending,  setSending]  = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, sent: 0, failed: 0 });
  const [results,  setResults]  = useState(null);
  const cancelRef = useRef(false);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setDailySentCount(loadDailyCount());
  }, []);

  // Load stores on mount
  useEffect(() => {
    (async () => {
      try {
        setStoresLoading(true);
        const list = (await api.getStores()) || [];
        setStores(list.map(normalizeStore));
      } catch (err) {
        console.error('[Promo] Failed to load stores:', err);
      } finally {
        setStoresLoading(false);
      }
    })();
  }, []);

  // Auto-load recipients on mount (all stores)
  useEffect(() => {
    fetchRecipients('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch recipients — always from DB (already excludes sent + unsubscribed) ─
  const fetchRecipients = useCallback(async (storeIds) => {
    setError(null);
    setRecipientsLoading(true);
    setResults(null);
    try {
      const raw  = (await api.getPromoRecipients({ storeIds })) || [];
      const rows = dedupeByEmail(raw.map(normalizeRecipient).filter((r) => r.email));
      rows.sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));
      setRecipients(rows);
      setExcludedEmails(new Set());
    } catch (err) {
      console.error('[Promo] Failed to load recipients:', err);
      setError(err?.message || 'Failed to load recipients.');
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }, []);

  // Manual reload — respects current store filter
  const loadRecipients = useCallback(() => {
    if (!allStores && selectedStoreIds.size === 0) {
      setError('Select at least one store, or choose "All stores".');
      return;
    }
    const storeIds = allStores ? 'all' : [...selectedStoreIds];
    fetchRecipients(storeIds);
  }, [allStores, selectedStoreIds, fetchRecipients]);

  const toggleStore = (id) => {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.email.includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.storeName.toLowerCase().includes(q) ||
        r.storeDomain.includes(q)
    );
  }, [recipients, search]);

  // selected = checked (not manually excluded)
  // DB already removed anyone already emailed, so no extra filter needed
  const selected = useMemo(
    () => recipients.filter((r) => !excludedEmails.has(r.email)),
    [recipients, excludedEmails]
  );

  // How many can go out today
  const remainingToday = Math.max(0, DAILY_CAP - dailySentCount);

  // Batch capped at today's remaining quota
  const batchToSend = useMemo(
    () => selected.slice(0, remainingToday),
    [selected, remainingToday]
  );

  const toggleRecipient = (email) =>
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });

  const selectAllFiltered = () =>
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => next.delete(r.email));
      return next;
    });

  const deselectAllFiltered = () =>
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.email));
      return next;
    });

  // ── Template builders ──────────────────────────────────────────────────────
  const bakeGlobals = useCallback(
    (s) => applyMerge(s, {
      discount_code:    discountCode,
      discount_percent: String(discountPercent),
      valid_days:       String(validDays),
      valid_until:      fmtLongDate(validUntil),
    }),
    [discountCode, discountPercent, validDays, validUntil]
  );

  const subjectTemplate = useMemo(() => bakeGlobals(subject), [bakeGlobals, subject]);

  const htmlTemplate = useMemo(() => {
    const code  = escapeHtml(discountCode);
    const pct   = escapeHtml(String(discountPercent));
    const days  = escapeHtml(String(validDays));
    const until = escapeHtml(fmtLongDate(validUntil));
    const validLine = until
      ? `⏰ Valid until <strong>${until}</strong>`
      : `⏰ Valid for <strong>${days} days only</strong>`;

    const cardHtml = `<div style="margin:24px 0;border:2px dashed #c7d2fe;background:#eef2ff;border-radius:14px;padding:24px;text-align:center;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6366f1;font-weight:700;margin-bottom:10px;">🎟️ Your exclusive one-time code</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:.06em;color:#312e81;font-family:monospace;background:#fff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 20px;display:inline-block;">${code}</div>
        <div style="margin-top:16px;font-size:16px;color:#374151;">✅ <strong>${pct}% OFF</strong> your next order</div>
        <div style="margin-top:6px;font-size:15px;color:#6b7280;">${validLine}</div>
      </div>`;

    const bodyHtml = String(body)
      .split('{{discount_box}}')
      .map((seg) => bakeGlobals(toParas(seg)))
      .join(cardHtml)
      .replace(
        /\{\{store_url\}\}/g,
        '<a href="{{store_url}}" style="color:#4f46e5;text-decoration:none;font-weight:600;">{{store_url}}</a>'
      );

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">{{store_name}}</h1>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
    </div>
  </div>
  <div style="text-align:center;padding:20px 16px;color:#9ca3af;font-size:12px;line-height:1.6;">
    <p style="margin:0 0 6px;">You're receiving this because you previously placed an order with {{store_name}}.</p>
    <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;
  }, [discountCode, discountPercent, validDays, validUntil, body, bakeGlobals]);

  const textTemplate = useMemo(() => {
    const discountText = [
      `Use code: ${discountCode}`,
      `${discountPercent}% OFF your next order`,
      validUntil ? `Valid until ${fmtLongDate(validUntil)}` : `Valid for ${validDays} days only`,
    ].join('\n');
    const main = bakeGlobals(String(body)).replace(/\{\{discount_box\}\}/g, discountText);
    return [
      main, '', '—',
      'You previously placed an order with {{store_name}}.',
      'Vanta Technologies, Montreal, Canada',
      'Unsubscribe: {{unsubscribe_url}}',
    ].join('\n');
  }, [body, discountCode, discountPercent, validDays, validUntil, bakeGlobals]);

  // ── Preview ────────────────────────────────────────────────────────────────
  const sampleRecipient = selected[previewIdx] || selected[0] || {
    email:       'customer@example.com',
    name:        'Customer',
    storeName:   stores[0]?.name   || 'Your Store',
    storeDomain: stores[0]?.domain || 'yourstore.ca',
    storeUrl:    stores[0]?.domain ? `https://${stores[0].domain}` : 'https://yourstore.ca',
  };

  const previewFields = {
    customer_email:  sampleRecipient.email,
    customer_name:   sampleRecipient.name || sampleRecipient.email,
    store_name:      sampleRecipient.storeName  || cleanDomain(sampleRecipient.storeDomain),
    store_url:       sampleRecipient.storeUrl,
    store_domain:    cleanDomain(sampleRecipient.storeDomain) || cleanDomain(sampleRecipient.storeUrl),
    unsubscribe_url: '#',
  };

  const previewHtml    = useMemo(() => applyMerge(htmlTemplate, previewFields), [htmlTemplate, previewFields]);
  const previewSubject = applyMerge(subjectTemplate, previewFields);

  const toPayloadRecipient = (r) => ({
    email:       r.email,
    name:        r.name || '',
    storeId:     r.storeId,
    storeName:   r.storeName  || cleanDomain(r.storeDomain),
    storeUrl:    r.storeUrl,
    storeDomain: cleanDomain(r.storeDomain) || cleanDomain(r.storeUrl),
  });

  const basePayload = () => ({
    fromEmail: FROM_EMAIL,
    fromName:  FROM_NAME,
    subjectTemplate,
    htmlTemplate,
    textTemplate,
    discountCode,
    discountPercent,
    validDays,
    validUntil,
  });

  // ── Test send — works immediately (stores load on mount) ───────────────────
  const sendTest = async () => {
    const addr = testEmail.trim();
    if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setTestMsg({ ok: false, text: 'Enter a valid email address.' });
      return;
    }

    let ref;
    if (selected.length > 0) {
      const r = selected[0];
      ref = { email: addr, name: addr, storeId: r.storeId, storeName: r.storeName, storeDomain: r.storeDomain, storeUrl: r.storeUrl };
    } else if (stores.length > 0) {
      const s      = stores[0];
      const domain = cleanDomain(s.domain);
      ref = { email: addr, name: addr, storeId: s.id, storeName: s.name, storeDomain: domain, storeUrl: domain ? `https://${domain}` : '' };
    } else {
      setTestMsg({ ok: false, text: 'No stores available yet. Wait a moment and retry.' });
      return;
    }

    setTestSending(true);
    setTestMsg(null);
    try {
      await api.sendPromoBlast({ ...basePayload(), test: true, recipients: [toPayloadRecipient(ref)] });
      setTestMsg({ ok: true, text: `Test sent — rendered as ${ref.storeName || ref.storeDomain}` });
    } catch (err) {
      setTestMsg({ ok: false, text: err?.message || 'Test send failed.' });
    } finally {
      setTestSending(false);
    }
  };

  // ── Blast send — 50/day cap, DB records sent emails ───────────────────────
  const startSend = async () => {
    setConfirmOpen(false);
    if (!batchToSend.length) return;

    cancelRef.current = false;
    setSending(true);
    setResults(null);

    const total = batchToSend.length;
    let sent = 0, failed = 0;
    const errors    = [];
    const justSent  = []; // collect for DB record-sent call
    setProgress({ done: 0, total, sent: 0, failed: 0 });

    const payload = basePayload();

    for (let i = 0; i < total; i++) {
      if (cancelRef.current) break;
      const r = batchToSend[i];
      try {
        const res = await api.sendPromoBlast({
          ...payload,
          recipients: [toPayloadRecipient(r)],
        });
        if ((res?.sent ?? 0) > 0 || (res?.failed ?? 1) === 0) {
          sent++;
          justSent.push({ email: r.email, storeDomain: r.storeDomain, storeName: r.storeName });
        } else {
          failed++;
          if (res?.errors?.length) errors.push(...res.errors);
        }
      } catch (err) {
        failed++;
        errors.push({ error: err?.message || 'Request failed', email: r.email });
      }
      setProgress({ done: i + 1, total, sent, failed });
    }

    // Record successful sends to DB so they are excluded from future loads
    if (justSent.length > 0) {
      try {
        await api.recordPromoSent({ emails: justSent, discountCode });
      } catch (err) {
        console.error('[Promo] Failed to record sent emails to DB:', err);
      }
    }

    // Update daily cap in localStorage
    const newCount = dailySentCount + sent;
    persistCount(newCount);
    setDailySentCount(newCount);

    setSending(false);
    setResults({
      total, sent, failed,
      errors,
      cancelled:       cancelRef.current,
      remainingToday:  Math.max(0, DAILY_CAP - newCount),
    });

    // Auto-refresh recipients so sent emails disappear from the list
    if (sent > 0) {
      const storeIds = allStores ? 'all' : [...selectedStoreIds];
      fetchRecipients(storeIds);
    }
  };

  const cancelSend = () => { cancelRef.current = true; };

  const resetDailyQuota = () => {
    localStorage.removeItem(LS_KEY_COUNT);
    localStorage.removeItem(LS_KEY_DATE);
    setDailySentCount(0);
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => !excludedEmails.has(r.email));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="peb-root">
      <style>{PEB_STYLES}</style>

      {/* Header */}
      <div className="peb-header">
        <div className="peb-header-left">
          <button className="peb-back" onClick={onBack} type="button">← Back</button>
          <h2>📣 Promo Email Blast</h2>
        </div>
        <div className="peb-from">
          <span className="peb-from-label">Sending from</span>
          <span className="peb-from-email">{FROM_NAME} &lt;{FROM_EMAIL}&gt;</span>
        </div>
      </div>

      {error && (
        <div className="peb-alert peb-alert--error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} type="button">×</button>
        </div>
      )}

      <div className="peb-body">
        {/* ── Left panel ── */}
        <aside className="peb-panel">
          <div className="peb-section">
            <h3>1. Audience</h3>
            <label className="peb-radio">
              <input type="radio" checked={allStores} onChange={() => setAllStores(true)} />
              <span>All stores</span>
            </label>
            <label className="peb-radio">
              <input type="radio" checked={!allStores} onChange={() => setAllStores(false)} />
              <span>Specific stores</span>
            </label>

            {!allStores && (
              <div className="peb-store-list">
                {storesLoading ? (
                  <div className="peb-muted">Loading stores…</div>
                ) : stores.length === 0 ? (
                  <div className="peb-muted">No stores found.</div>
                ) : (
                  stores.map((s) => (
                    <label key={s.id} className="peb-check">
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.has(s.id)}
                        onChange={() => toggleStore(s.id)}
                      />
                      <span className="peb-check-name">{s.name}</span>
                      <span className="peb-check-domain">{s.domain}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            <button
              className="peb-btn peb-btn--primary peb-block"
              onClick={loadRecipients}
              disabled={recipientsLoading}
              type="button"
            >
              {recipientsLoading ? 'Loading…' : '🔄 Reload purchasers'}
            </button>

            {recipients.length > 0 && (
              <div className="peb-muted peb-mt8">
                {selected.length} of {recipients.length} selected (already-emailed excluded by DB)
              </div>
            )}
          </div>

          {/* Daily cap */}
          <div className="peb-section">
            <h3>Daily Cap</h3>
            <div className="peb-cap-bar">
              <div
                className="peb-cap-fill"
                style={{ width: `${Math.min(100, (dailySentCount / DAILY_CAP) * 100)}%` }}
              />
            </div>
            <div className="peb-muted peb-mt8">
              {dailySentCount} / {DAILY_CAP} sent today · <strong>{remainingToday}</strong> remaining
            </div>
            {batchToSend.length < selected.length && selected.length > 0 && (
              <div className="peb-warn peb-mt8">
                Only {batchToSend.length} of {selected.length} will send today (cap). Rest deferred.
              </div>
            )}
            <button
              className="peb-btn peb-btn--ghost peb-btn--sm peb-mt8"
              onClick={resetDailyQuota}
              type="button"
            >
              ↺ Reset today's count
            </button>
          </div>

          {/* Discount */}
          <div className="peb-section">
            <h3>2. Discount</h3>
            <label className="peb-field">
              <span>Code</span>
              <input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                type="text"
              />
            </label>
            <div className="peb-row2">
              <label className="peb-field">
                <span>% Off</span>
                <input
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                  type="number" min="1" max="100"
                />
              </label>
              <label className="peb-field">
                <span>Valid (days)</span>
                <input
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value) || 0)}
                  type="number" min="1"
                />
              </label>
            </div>
            <label className="peb-field">
              <span>Valid until</span>
              <input
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                type="date"
              />
            </label>
            <div className="peb-muted">
              Leave blank to use “{validDays} days only” wording instead of a fixed date.
            </div>
          </div>
        </aside>

        {/* ── Right: tabs ── */}
        <main className="peb-main">
          <div className="peb-tabs">
            <button className={`peb-tab ${tab === 'recipients' ? 'is-active' : ''}`} onClick={() => setTab('recipients')} type="button">
              Recipients ({selected.length})
            </button>
            <button className={`peb-tab ${tab === 'compose' ? 'is-active' : ''}`} onClick={() => setTab('compose')} type="button">
              Compose
            </button>
            <button className={`peb-tab ${tab === 'preview' ? 'is-active' : ''}`} onClick={() => setTab('preview')} type="button">
              Preview
            </button>
          </div>

          {/* Recipients tab */}
          {tab === 'recipients' && (
            <div className="peb-tabpane">
              {recipientsLoading ? (
                <div className="peb-empty"><p>Loading purchasers…</p></div>
              ) : recipients.length === 0 ? (
                <div className="peb-empty">
                  <p>No new recipients found.</p>
                  <p className="peb-muted">
                    Everyone has already been emailed, or no purchasers exist for this store selection.
                  </p>
                </div>
              ) : (
                <>
                  <div className="peb-toolbar">
                    <input
                      className="peb-search"
                      placeholder="Search email, name, or store…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button className="peb-btn peb-btn--ghost" onClick={selectAllFiltered} type="button">Select all</button>
                    <button className="peb-btn peb-btn--ghost" onClick={deselectAllFiltered} type="button">Clear</button>
                  </div>
                  <div className="peb-table-wrap">
                    <table className="peb-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={() => allFilteredSelected ? deselectAllFiltered() : selectAllFiltered()}
                            />
                          </th>
                          <th>Customer</th>
                          <th>Purchase store</th>
                          <th>Orders</th>
                          <th>Last order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.email} className={excludedEmails.has(r.email) ? 'is-excluded' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!excludedEmails.has(r.email)}
                                onChange={() => toggleRecipient(r.email)}
                              />
                            </td>
                            <td>
                              <div className="peb-cust-email">{r.email}</div>
                              {r.name && <div className="peb-cust-name">{r.name}</div>}
                            </td>
                            <td>
                              <div className="peb-cust-name">{r.storeName || '—'}</div>
                              <div className="peb-cust-email">{r.storeDomain}</div>
                            </td>
                            <td>{r.orderCount ?? '—'}</td>
                            <td>{fmtDate(r.lastOrderAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="peb-muted peb-mt8">
                    Showing {filtered.length} of {recipients.length}.
                    Already-emailed customers are excluded automatically by the database.
                    Duplicate emails merged to one (most recent purchase store).
                  </div>
                </>
              )}
            </div>
          )}

          {/* Compose tab */}
          {tab === 'compose' && (
            <div className="peb-tabpane peb-compose">
              <label className="peb-field">
                <span>Subject</span>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} type="text" />
              </label>
              <label className="peb-field">
                <span>Email body</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={22} />
              </label>
              <div className="peb-placeholders">
                <strong>Placeholders:</strong>{' '}
                <code>{'{{discount_box}}'}</code> <code>{'{{customer_email}}'}</code>{' '}
                <code>{'{{customer_name}}'}</code> <code>{'{{store_name}}'}</code>{' '}
                <code>{'{{store_url}}'}</code> <code>{'{{store_domain}}'}</code>{' '}
                <code>{'{{discount_code}}'}</code> <code>{'{{discount_percent}}'}</code>{' '}
                <code>{'{{valid_days}}'}</code> <code>{'{{valid_until}}'}</code>
                <div className="peb-mt8">
                  <code>{'{{discount_box}}'}</code> renders the styled code card.{' '}
                  <code>{'{{store_url}}'}</code> auto-fills from each recipient's purchase store.{' '}
                  <code>{'{{valid_until}}'}</code> prints the expiry date (e.g. June 15, 2026).
                </div>
              </div>
            </div>
          )}

          {/* Preview tab */}
          {tab === 'preview' && (
            <div className="peb-tabpane">
              <div className="peb-toolbar">
                {selected.length > 0 ? (
                  <label className="peb-field peb-field--inline">
                    <span>Preview as</span>
                    <select value={previewIdx} onChange={(e) => setPreviewIdx(Number(e.target.value))}>
                      {selected.slice(0, 100).map((r, i) => (
                        <option key={r.email} value={i}>
                          {r.email} — {r.storeName || r.storeDomain}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="peb-muted">Using sample data.</span>
                )}
              </div>
              <div className="peb-subjline"><strong>Subject:</strong> {previewSubject}</div>
              <iframe className="peb-iframe" title="Email preview" srcDoc={previewHtml} />
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <div className="peb-footer">
        <div className="peb-test">
          <input
            className="peb-search"
            placeholder="Send a test to me@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            type="email"
          />
          <button
            className="peb-btn peb-btn--ghost"
            onClick={sendTest}
            disabled={testSending || !testEmail || stores.length === 0}
            type="button"
          >
            {testSending ? 'Sending…' : '✉️ Send test'}
          </button>
          {testMsg && (
            <span className={`peb-test-msg ${testMsg.ok ? 'ok' : 'err'}`}>{testMsg.text}</span>
          )}
          {!testMsg && stores.length > 0 && (
            <span className="peb-test-hint">
              {selected.length > 0
                ? <>Renders as: <strong>{selected[0].storeName || selected[0].storeDomain}</strong> (purchase store)</>
                : <>Renders as: <strong>{stores[0].name || stores[0].domain}</strong> (first store)</>}
            </span>
          )}
        </div>
        <button
          className="peb-btn peb-btn--send"
          onClick={() => setConfirmOpen(true)}
          disabled={sending || batchToSend.length === 0}
          type="button"
        >
          🚀 Send to {batchToSend.length} recipient{batchToSend.length === 1 ? '' : 's'}
          {batchToSend.length < selected.length
            ? ` (${selected.length - batchToSend.length} deferred)`
            : ''}
        </button>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="peb-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="peb-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm blast</h3>
            <p>
              Sending to <strong>{batchToSend.length}</strong> recipient{batchToSend.length === 1 ? '' : 's'}{' '}
              from <strong>{FROM_EMAIL}</strong>.
            </p>
            {selected.length > batchToSend.length && (
              <p className="peb-muted">
                ⏳ {selected.length - batchToSend.length} more deferred — they'll go in tomorrow's batch (50/day cap).
              </p>
            )}
            <p className="peb-muted">Subject: {previewSubject}</p>
            {validUntil && (
              <p className="peb-muted">Discount valid until: <strong>{fmtLongDate(validUntil)}</strong></p>
            )}
            <p className="peb-warn">
              Already-emailed customers are excluded by the database. This cannot be undone.
            </p>
            <div className="peb-modal-actions">
              <button className="peb-btn peb-btn--ghost" onClick={() => setConfirmOpen(false)} type="button">Cancel</button>
              <button className="peb-btn peb-btn--send" onClick={startSend} type="button">Send now</button>
            </div>
          </div>
        </div>
      )}

      {/* Sending / results overlay */}
      {(sending || results) && (
        <div className="peb-overlay">
          <div className="peb-modal">
            {sending ? (
              <>
                <h3>Sending…</h3>
                <div className="peb-progress">
                  <div
                    className="peb-progress-bar"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="peb-muted">
                  {progress.done} / {progress.total} processed · {progress.sent} sent · {progress.failed} failed
                </p>
                <div className="peb-modal-actions">
                  <button className="peb-btn peb-btn--ghost" onClick={cancelSend} type="button">Stop</button>
                </div>
              </>
            ) : (
              <>
                <h3>{results.cancelled ? 'Stopped' : 'Done'}</h3>
                <p>
                  ✅ <strong>{results.sent}</strong> sent · ❌ <strong>{results.failed}</strong> failed (of {results.total})
                </p>
                {results.remainingToday > 0 && (
                  <p className="peb-muted">📅 {results.remainingToday} sends remaining today.</p>
                )}
                {results.remainingToday === 0 && (
                  <p className="peb-warn">🛑 Daily cap of {DAILY_CAP} reached. Resets tomorrow.</p>
                )}
                {results.errors?.length > 0 && (
                  <div className="peb-errors">
                    {results.errors.slice(0, 8).map((e, i) => (
                      <div key={i}>{e.error || e}{e.email ? ` (${e.email})` : ''}</div>
                    ))}
                    {results.errors.length > 8 && <div>…and {results.errors.length - 8} more</div>}
                  </div>
                )}
                <div className="peb-modal-actions">
                  <button className="peb-btn peb-btn--primary" onClick={() => setResults(null)} type="button">Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const PEB_STYLES = `
.peb-root{display:flex;flex-direction:column;height:100%;background:#f9fafb;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
.peb-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-bottom:1px solid #e5e7eb;}
.peb-header-left{display:flex;align-items:center;gap:14px;}
.peb-header h2{margin:0;font-size:18px;}
.peb-back{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;}
.peb-from{text-align:right;font-size:12px;}
.peb-from-label{display:block;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;font-size:10px;}
.peb-from-email{font-weight:600;color:#4f46e5;}
.peb-alert{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;font-size:14px;}
.peb-alert--error{background:#fef2f2;color:#b91c1c;border-bottom:1px solid #fecaca;}
.peb-alert button{background:none;border:none;font-size:18px;cursor:pointer;color:inherit;}
.peb-body{flex:1;display:flex;min-height:0;}
.peb-panel{width:300px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;overflow-y:auto;padding:16px;}
.peb-section{margin-bottom:24px;}
.peb-section h3{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;}
.peb-radio{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:14px;cursor:pointer;}
.peb-store-list{max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin:8px 0;}
.peb-check{display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;cursor:pointer;}
.peb-check-name{flex:1;}
.peb-check-domain{color:#9ca3af;font-size:11px;}
.peb-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;font-size:13px;color:#374151;}
.peb-field--inline{flex-direction:row;align-items:center;gap:8px;margin:0;}
.peb-field input,.peb-field select,.peb-field textarea{border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;width:100%;box-sizing:border-box;}
.peb-field textarea{resize:vertical;line-height:1.5;}
.peb-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.peb-btn{border:none;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
.peb-btn:disabled{opacity:.5;cursor:not-allowed;}
.peb-btn--primary{background:#4f46e5;color:#fff;}
.peb-btn--ghost{background:#fff;border:1px solid #d1d5db;color:#374151;}
.peb-btn--send{background:#16a34a;color:#fff;}
.peb-btn--sm{padding:5px 10px;font-size:12px;}
.peb-block{width:100%;margin-top:8px;}
.peb-muted{color:#9ca3af;font-size:12px;}
.peb-warn{color:#b45309;font-size:12px;}
.peb-mt8{margin-top:8px;}
.peb-cap-bar{height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin-top:4px;}
.peb-cap-fill{height:100%;background:#4f46e5;transition:width .3s;}
.peb-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;}
.peb-tabs{display:flex;gap:4px;padding:12px 16px 0;background:#fff;border-bottom:1px solid #e5e7eb;}
.peb-tab{border:none;background:none;padding:10px 16px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;}
.peb-tab.is-active{color:#4f46e5;border-bottom-color:#4f46e5;}
.peb-tabpane{flex:1;overflow-y:auto;padding:16px;min-height:0;}
.peb-empty{text-align:center;padding:48px 16px;}
.peb-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px;}
.peb-search{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:14px;font-family:inherit;}
.peb-table-wrap{border:1px solid #e5e7eb;border-radius:10px;overflow:auto;background:#fff;}
.peb-table{width:100%;border-collapse:collapse;font-size:13px;}
.peb-table th{text-align:left;padding:10px 12px;background:#f9fafb;color:#6b7280;font-weight:600;position:sticky;top:0;border-bottom:1px solid #e5e7eb;}
.peb-table td{padding:8px 12px;border-bottom:1px solid #f3f4f6;}
.peb-table tr.is-excluded{opacity:.4;}
.peb-cust-email{font-weight:500;}
.peb-cust-name{color:#9ca3af;font-size:12px;}
.peb-compose{max-width:760px;}
.peb-placeholders{font-size:12px;color:#6b7280;margin-top:8px;line-height:2;}
.peb-placeholders code{background:#eef2ff;color:#4f46e5;padding:2px 6px;border-radius:5px;font-size:11px;}
.peb-subjline{padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;font-size:14px;}
.peb-iframe{width:100%;height:560px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;}
.peb-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px;background:#fff;border-top:1px solid #e5e7eb;}
.peb-test{display:flex;align-items:center;gap:8px;flex:1;}
.peb-test-msg{font-size:12px;white-space:nowrap;}
.peb-test-msg.ok{color:#16a34a;}
.peb-test-msg.err{color:#b91c1c;}
.peb-test-hint{font-size:12px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.peb-test-hint strong{color:#374151;}
.peb-overlay{position:fixed;inset:0;background:rgba(17,24,39,.5);display:flex;align-items:center;justify-content:center;z-index:1000;}
.peb-modal{background:#fff;border-radius:14px;padding:24px;width:min(480px,90vw);}
.peb-modal h3{margin:0 0 12px;}
.peb-modal p{margin:0 0 10px;font-size:14px;line-height:1.5;}
.peb-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;}
.peb-progress{height:10px;background:#e5e7eb;border-radius:6px;overflow:hidden;margin:12px 0;}
.peb-progress-bar{height:100%;background:#4f46e5;transition:width .2s;}
.peb-errors{max-height:140px;overflow-y:auto;background:#fef2f2;border-radius:8px;padding:10px;font-size:12px;color:#b91c1c;margin:8px 0;}
@media(max-width:860px){.peb-body{flex-direction:column;}.peb-panel{width:auto;border-right:none;border-bottom:1px solid #e5e7eb;}}
`;