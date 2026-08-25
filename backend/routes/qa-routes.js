'use strict';

/**
 * QA AUTOMATION — admin only.
 *
 * Grades outbound agent replies against the internal voice guide.
 *   1. Deterministic rule pass  (lib/qa-voice-rules.js)  — free, instant
 *   2. AI voice pass            (Claude Haiku)           — optional, judges
 *      the things regex cannot: apology spiral, reframing, whether it lands
 *      on the outcome the customer wants.
 *
 * Final score = 60% rules + 40% AI voice when the AI pass runs, otherwise
 * 100% rules. A critical rule violation caps the combined score at
 * CRITICAL_CAP, which is imported from the rule engine so the two layers
 * cannot drift apart.
 *
 * SCHEMA: the qa_reviews table is owned by migration 027_qa_reviews in
 * database.js. Nothing in this file creates or alters it. It used to build
 * itself on the first request, on the app pool, under a 15s statement timeout.
 *
 * EVERY route in here is admin-gated. There is no agent-facing view: agents
 * seeing their own live QA scores changes how they write, and we want to
 * measure what they actually send.
 */

const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../auth');
const {
  evaluateReply,
  gradeFor,
  RULE_CATALOG,
  VOICE_REFERENCE,
  CRITICAL_CAP,
} = require('../lib/qa-voice-rules');
const { callAnthropicAPIWithRetry } = require('../lib/ai-suggestions');

/**
 * The canonical auto-reply. Kept for reference, but the scan filters with the
 * LIKE pattern below instead of an exact match: the live text has been sent
 * with both a curly and a straight apostrophe, and with trailing whitespace,
 * and an exact `<>` comparison let every one of those variants through to be
 * graded as if an agent had written it.
 */
const AUTO_REPLY_TEXT = 'Thanks for reaching out! We\u2019re available 24/7 and will get back to you as soon as possible. We\u2019re always here and ready to help!';
const AUTO_REPLY_LIKE = 'Thanks for reaching out! We_re available 24/7 and will get back to you as soon as possible.%';

const QA_MODEL = process.env.QA_MODEL || 'claude-haiku-4-5-20251001';
const QA_AI_CONCURRENCY = Number(process.env.QA_AI_CONCURRENCY || 3);
const QA_MIN_WORDS = Number(process.env.QA_MIN_WORDS || 8);

const QA_AUTO_SCAN_ENABLED = process.env.QA_AUTO_SCAN !== 'false';
const QA_AUTO_SCAN_MINUTES = Math.max(5, Number(process.env.QA_AUTO_SCAN_MINUTES || 30));
const QA_AUTO_SCAN_LIMIT = Math.max(1, Number(process.env.QA_AUTO_SCAN_LIMIT || 60));

/**
 * @deprecated No-op kept only so an existing `ensureQaTables(db.pool)` call in
 * server.js does not throw on deploy. Delete the call site, then delete this.
 */
let ensureWarned = false;
async function ensureQaTables() {
  if (!ensureWarned) {
    console.warn('[QA] ensureQaTables() is a no-op — qa_reviews is owned by migration 027_qa_reviews');
    ensureWarned = true;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// SCAN LOCK
// ───────────────────────────────────────────────────────────────────────────

/**
 * Serialise scans across instances. Without this, every Render instance runs
 * its own auto-scan tick against the same unreviewed messages: ON CONFLICT
 * (message_id) keeps the data correct, but you pay for every duplicate AI call.
 *
 * The lock is held on the MAINTENANCE pool, not db.pool. A scan runs for
 * minutes and a session-level advisory lock pins the connection holding it —
 * pinning an app-pool connection for that long is exactly what starves the
 * pool. The maintenance pool is separate (max 2) and exists for this.
 *
 * Falls through unlocked if database.js predates LOCKS.QA_SCAN.
 */
async function withScanLock(fn) {
  if (typeof db.withMaintenance !== 'function'
      || typeof db.withAdvisoryLock !== 'function'
      || !db.LOCKS?.QA_SCAN) {
    return { skipped: false, result: await fn() };
  }
  return db.withMaintenance(mp => db.withAdvisoryLock(mp, db.LOCKS.QA_SCAN, fn));
}

// ───────────────────────────────────────────────────────────────────────────
// AI VOICE PASS
// ───────────────────────────────────────────────────────────────────────────

const AI_SYSTEM = `You are a QA reviewer for an e-commerce support team. You grade ONE agent reply against a fixed house voice. You are strict, terse, and you never rewrite the whole thing unless asked.

THE HOUSE VOICE — this is the owner's own reply and it is the standard:
"""
${VOICE_REFERENCE}
"""

What that voice does:
- Opens "Hello!" then thanks them in the same breath and goes straight into the answer. Zero apology paragraph.
- Run-on sentences chained with but / so / since / and. Never clean balanced sentences.
- Small mistakes stay in. Dropped apostrophes. This is proof a person wrote it.
- Reframes a delay as a GOOD problem: not "we are behind", instead "way too many orders to fulfill".
- Exactly one ALL CAPS word for emphasis, or none.
- Always a real date or day. Never "shortly", never "as soon as possible".
- One short sentence of WHY, so the delay stops feeling like a lie.
- Ends on the picture the customer wants: the box arriving, the money landing back on the card.
- Steps over awkward details it cannot answer. Never confirms, never denies, never gets defensive.
- Just stops. No name, no signature, no "let me know if you have any other questions".

Grade these seven dimensions 0-5 (5 = indistinguishable from the owner):
opener, rhythm, humanTexture, reframing, specificity, endsOnOutcome, handlesAwkward

Respond ONLY with valid JSON. No markdown, no preamble, no backticks.
{
  "scores": { "opener": 0, "rhythm": 0, "humanTexture": 0, "reframing": 0, "specificity": 0, "endsOnOutcome": 0, "handlesAwkward": 0 },
  "soundsLikeAi": true,
  "aiTell": "the single strongest tell that a model wrote this, or null",
  "coaching": "one sentence, direct, addressed to the agent",
  "betterVersion": "the same reply rewritten in the house voice, 40-90 words, two paragraphs"
}`;

async function aiVoicePass(reply, customerPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userPrompt = [
    customerPrompt ? `WHAT THE CUSTOMER WROTE:\n"""\n${String(customerPrompt).slice(0, 1500)}\n"""\n` : '',
    `THE AGENT REPLY TO GRADE:\n"""\n${String(reply).slice(0, 3000)}\n"""`,
    '\nGrade it. Return only JSON.',
  ].join('\n');

  const body = JSON.stringify({
    model: QA_MODEL,
    max_tokens: 900,
    system: AI_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  try {
    const data = await callAnthropicAPIWithRetry(body, apiKey);
    const raw = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const s = parsed.scores || {};
    const keys = ['opener', 'rhythm', 'humanTexture', 'reframing', 'specificity', 'endsOnOutcome', 'handlesAwkward'];
    const nums = keys.map(k => {
      const n = Number(s[k]);
      return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
    });
    const voiceScore = Math.round((nums.reduce((a, b) => a + b, 0) / (keys.length * 5)) * 100);

    return {
      voiceScore,
      scores: keys.reduce((acc, k, i) => { acc[k] = nums[i]; return acc; }, {}),
      soundsLikeAi: parsed.soundsLikeAi === true,
      aiTell: parsed.aiTell || null,
      coaching: parsed.coaching || null,
      betterVersion: parsed.betterVersion || null,
      model: QA_MODEL,
    };
  } catch (err) {
    console.warn('[QA] AI voice pass failed:', err.message);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// COMBINE
// ───────────────────────────────────────────────────────────────────────────

function combine(ruleReport, ai) {
  if (!ai) {
    return { score: ruleReport.score, grade: ruleReport.grade, voiceScore: null };
  }
  let score = Math.round(ruleReport.score * 0.6 + ai.voiceScore * 0.4);
  // A critical rule violation still caps the whole thing. No AI charm offensive
  // can rescue a reply that shipped with "kindly" in it. Cap comes from the rule
  // engine so tuning it there moves both layers at once.
  if (ruleReport.criticalCount > 0) score = Math.min(score, CRITICAL_CAP);
  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFor(score), voiceScore: ai.voiceScore };
}

async function evaluateForQa(text, customerPrompt, { useAi = true } = {}) {
  const ruleReport = evaluateReply(text);
  const ai = useAi ? await aiVoicePass(text, customerPrompt) : null;
  const merged = combine(ruleReport, ai);
  return { ruleReport, ai, ...merged };
}

// ───────────────────────────────────────────────────────────────────────────
// SCANNER
// ───────────────────────────────────────────────────────────────────────────

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.allSettled(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

/**
 * Pull agent messages that have never been reviewed and grade them.
 * Deliberately uses db.pool (not a pinned client) — the AI pass makes network
 * calls and pinning a connection across those starves the pool.
 *
 * The conversations join is load-bearing: shop_id lives on conversations, not
 * on messages, so without it every qa_reviews.store_id was written NULL.
 *
 * Call this through withScanLock() unless you deliberately want a second scan
 * running alongside whatever else is in flight.
 */
async function runQaScan({ hours = 2, limit = 40, useAi = true, agentId = null, storeGroup = null, source = 'auto' } = {}) {
  const params = [String(hours), limit, AUTO_REPLY_LIKE];
  const extra = [];
  if (agentId) { params.push(String(agentId)); extra.push(`AND m.sender_id = $${params.length}`); }
  if (storeGroup) {
    params.push(storeGroup);
    extra.push(`AND c.shop_id IN (SELECT id FROM stores WHERE store_group = $${params.length})`);
  }

  const { rows } = await db.pool.query(`
    SELECT m.*,
           c.shop_id AS conversation_shop_id,
           (SELECT m2.content FROM messages m2
             WHERE m2.conversation_id = m.conversation_id
               AND m2.sender_type = 'customer'
               AND m2.sent_at < m.sent_at
             ORDER BY m2.sent_at DESC LIMIT 1) AS customer_prompt
      FROM messages m
      LEFT JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN qa_reviews q ON q.message_id = m.id
     WHERE m.sender_type = 'agent'
       AND m.sender_id IS NOT NULL
       AND m.content IS NOT NULL
       AND length(trim(m.content)) > 0
       AND m.content NOT LIKE $3
       AND m.sent_at >= NOW() - ($1 || ' hours')::interval
       AND q.id IS NULL
       ${extra.join('\n       ')}
     ORDER BY m.sent_at DESC
     LIMIT $2
  `, params);

  if (!rows.length) return { scanned: 0, reviewed: 0, skipped: 0, failed: 0, avgScore: null };

  let reviewed = 0, skipped = 0, failed = 0;
  const scores = [];

  await mapLimit(rows, useAi ? QA_AI_CONCURRENCY : 10, async (row) => {
    const content = String(row.content || '').trim();

    // One-liners like "Sure thing" are not a graded reply, they are a follow-up
    // in a live thread. Grading them would tank every agent's average.
    if (content.split(/\s+/).length < QA_MIN_WORDS) { skipped += 1; return; }

    try {
      const result = await evaluateForQa(content, row.customer_prompt, { useAi });
      const storeId = row.conversation_shop_id ?? row.shop_id ?? row.store_id ?? null;

      await db.pool.query(`
        INSERT INTO qa_reviews (
          message_id, conversation_id, store_id, agent_id, agent_name, content, customer_prompt,
          rule_score, voice_score, score, grade, critical_count, major_count, minor_count,
          rule_report, ai_report, model, source, message_sent_at, reviewed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
        ON CONFLICT (message_id) DO UPDATE SET
          store_id = EXCLUDED.store_id,
          rule_score = EXCLUDED.rule_score, voice_score = EXCLUDED.voice_score,
          score = EXCLUDED.score, grade = EXCLUDED.grade,
          critical_count = EXCLUDED.critical_count, major_count = EXCLUDED.major_count,
          minor_count = EXCLUDED.minor_count, rule_report = EXCLUDED.rule_report,
          ai_report = EXCLUDED.ai_report, model = EXCLUDED.model,
          source = EXCLUDED.source, reviewed_at = NOW()
      `, [
        row.id, row.conversation_id, storeId, String(row.sender_id), row.sender_name || null,
        content, row.customer_prompt || null,
        result.ruleReport.score, result.voiceScore, result.score, result.grade,
        result.ruleReport.criticalCount, result.ruleReport.majorCount, result.ruleReport.minorCount,
        JSON.stringify(result.ruleReport), result.ai ? JSON.stringify(result.ai) : null,
        result.ai ? result.ai.model : null, source, row.sent_at || null,
      ]);

      reviewed += 1;
      scores.push(result.score);
    } catch (err) {
      failed += 1;
      console.error(`[QA] Review failed for message ${row.id}:`, err.message);
    }
  });

  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  console.log(`🔍 [QA] Scanned ${rows.length} — reviewed ${reviewed}, skipped ${skipped}, failed ${failed}, avg ${avgScore ?? 'n/a'}`);
  return { scanned: rows.length, reviewed, skipped, failed, avgScore };
}

// ───────────────────────────────────────────────────────────────────────────
// AUTO SCAN
// ───────────────────────────────────────────────────────────────────────────

let autoScanTimer = null;

/**
 * Call this once from server.js after the pool is up:
 *   startQaAutoScan({ appCache });
 * Until it is called, /health reports autoScan: false rather than claiming a
 * scheduler that does not exist. Safe to call on every instance — the advisory
 * lock means only one of them actually scans on any given tick.
 */
function startQaAutoScan({ appCache } = {}) {
  if (!QA_AUTO_SCAN_ENABLED) {
    console.log('⏸️  [QA] Auto-scan disabled by QA_AUTO_SCAN=false');
    return null;
  }
  if (autoScanTimer) return autoScanTimer;

  // Window is double the interval so a slow tick never leaves a gap.
  const hours = Math.max(1, Math.ceil((QA_AUTO_SCAN_MINUTES * 2) / 60));

  const tick = async () => {
    try {
      const outcome = await withScanLock(() => runQaScan({
        hours,
        limit: QA_AUTO_SCAN_LIMIT,
        useAi: !!process.env.ANTHROPIC_API_KEY,
        source: 'auto',
      }));
      if (outcome.skipped) {
        console.log('⏭️  [QA] Scan already running elsewhere — skipping this tick');
        return;
      }
      const result = outcome.result;
      if (result.reviewed) appCache?.invalidatePrefix?.('qa:');
      if (result.failed) console.warn(`[QA] Auto-scan finished with ${result.failed} failures`);
    } catch (err) {
      console.error('[QA] Auto-scan tick failed:', err.message);
    }
  };

  autoScanTimer = setInterval(tick, QA_AUTO_SCAN_MINUTES * 60 * 1000);
  if (typeof autoScanTimer.unref === 'function') autoScanTimer.unref();
  setTimeout(tick, 60 * 1000).unref?.();

  console.log(`⏱️  [QA] Auto-scan every ${QA_AUTO_SCAN_MINUTES}m over a ${hours}h window`);
  return autoScanTimer;
}

function stopQaAutoScan() {
  if (autoScanTimer) clearInterval(autoScanTimer);
  autoScanTimer = null;
}

// ───────────────────────────────────────────────────────────────────────────
// ROUTES
// ───────────────────────────────────────────────────────────────────────────

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function windowClause(req, params, col = 'message_sent_at') {
  const { dateFrom, dateTo, days } = req.query;
  const parts = [];
  if (dateFrom) { params.push(dateFrom); parts.push(`${col} >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); parts.push(`${col} <= $${params.length}`); }
  if (!dateFrom && !dateTo) {
    params.push(String(Math.min(180, Math.max(1, parseInt(days, 10) || 14))));
    parts.push(`${col} >= NOW() - ($${params.length} || ' days')::interval`);
  }
  return parts;
}

function createQaRoutes({ appCache } = {}) {
  const router = express.Router();

  router.use(authenticateToken, adminOnly);

  // ── Config / health ────────────────────────────────────────────────────
  router.get('/health', async (req, res) => {
    try {
      const { rows } = await db.pool.query(
        `SELECT COUNT(*)::int AS total,
                MAX(reviewed_at) AS last_review,
                COUNT(*) FILTER (WHERE reviewed_at >= NOW() - INTERVAL '24 hours')::int AS last_24h
           FROM qa_reviews`);
      const r = rows[0] || {};
      // Mapped explicitly rather than spread: the raw row is snake_case and the
      // dashboard reads camelCase, which is why last24h rendered undefined.
      res.json({
        ok: true,
        aiEnabled: !!process.env.ANTHROPIC_API_KEY,
        model: QA_MODEL,
        autoScan: autoScanTimer !== null,
        autoScanMinutes: autoScanTimer !== null ? QA_AUTO_SCAN_MINUTES : null,
        minWords: QA_MIN_WORDS,
        total: r.total || 0,
        last24h: r.last_24h || 0,
        lastReview: r.last_review || null,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── The rule catalogue, for the Rules tab ──────────────────────────────
  router.get('/rules', (req, res) => {
    res.json({ reference: VOICE_REFERENCE, rules: RULE_CATALOG, criticalCap: CRITICAL_CAP });
  });

  // ── Ad-hoc checker: paste a draft, get the rule pass back instantly ────
  router.post('/check', async (req, res) => {
    try {
      const { text, customerMessage, useAi = false } = req.body || {};
      if (!text || !String(text).trim()) return res.status(400).json({ error: 'text is required' });
      const wantsAi = !!useAi && !!process.env.ANTHROPIC_API_KEY;
      const result = await evaluateForQa(String(text), customerMessage || null, { useAi: wantsAi });
      res.json({ ...result, aiRequested: !!useAi, aiRan: !!result.ai });
    } catch (e) { console.error('[QA] check error:', e.message); res.status(500).json({ error: e.message }); }
  });

  // ── Trigger a scan on demand ───────────────────────────────────────────
  router.post('/scan', async (req, res) => {
    try {
      const hours = Math.min(720, Math.max(1, parseInt(req.body?.hours, 10) || 24));
      const limit = Math.min(200, Math.max(1, parseInt(req.body?.limit, 10) || 50));
      const useAi = req.body?.useAi !== false && !!process.env.ANTHROPIC_API_KEY;

      // Same lock as the auto-scan. Two overlapping scans would pick up the
      // same unreviewed messages and pay for both AI passes.
      const outcome = await withScanLock(() => runQaScan({
        hours, limit, useAi,
        agentId: req.body?.agentId || null,
        storeGroup: req.body?.storeGroup || null,
        source: 'manual',
      }));

      if (outcome.skipped) {
        return res.status(409).json({
          error: 'A scan is already running. Give it a minute and try again.',
          scanning: true,
        });
      }
      appCache?.invalidatePrefix?.('qa:');
      res.json({ ok: true, useAi, ...outcome.result });
    } catch (e) { console.error('[QA] scan error:', e.message); res.status(500).json({ error: e.message }); }
  });

  // ── Re-grade one message (e.g. after tuning a rule) ────────────────────
  router.post('/reviews/:id/regrade', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { rows } = await db.pool.query('SELECT * FROM qa_reviews WHERE id = $1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Review not found' });
      const row = rows[0];
      const useAi = req.body?.useAi !== false && !!process.env.ANTHROPIC_API_KEY;
      const result = await evaluateForQa(row.content, row.customer_prompt, { useAi });
      const { rows: updated } = await db.pool.query(`
        UPDATE qa_reviews SET
          rule_score = $2, voice_score = $3, score = $4, grade = $5,
          critical_count = $6, major_count = $7, minor_count = $8,
          rule_report = $9, ai_report = $10, model = $11, source = 'manual', reviewed_at = NOW()
        WHERE id = $1 RETURNING *
      `, [
        id, result.ruleReport.score, result.voiceScore, result.score, result.grade,
        result.ruleReport.criticalCount, result.ruleReport.majorCount, result.ruleReport.minorCount,
        JSON.stringify(result.ruleReport), result.ai ? JSON.stringify(result.ai) : null,
        result.ai ? result.ai.model : null,
      ]);
      appCache?.invalidatePrefix?.('qa:');
      res.json(updated[0]);
    } catch (e) { console.error('[QA] regrade error:', e.message); res.status(500).json({ error: e.message }); }
  });

  // ── Review list ────────────────────────────────────────────────────────
  router.get('/reviews', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, parseInt(req.query.limit, 10) || 25);
      const offset = (page - 1) * limit;

      const params = [];
      const filters = windowClause(req, params);

      if (req.query.agentId) { params.push(String(req.query.agentId)); filters.push(`agent_id = $${params.length}`); }
      if (req.query.grade) { params.push(String(req.query.grade).toUpperCase()); filters.push(`grade = $${params.length}`); }
      if (req.query.maxScore) { params.push(parseInt(req.query.maxScore, 10)); filters.push(`score <= $${params.length}`); }
      if (req.query.minScore) { params.push(parseInt(req.query.minScore, 10)); filters.push(`score >= $${params.length}`); }
      if (req.query.criticalOnly === 'true') filters.push('critical_count > 0');
      if (req.query.storeId) { params.push(parseInt(req.query.storeId, 10)); filters.push(`store_id = $${params.length}`); }
      if (req.query.q) {
        params.push(`%${String(req.query.q).replace(/[\\%_]/g, c => '\\' + c)}%`);
        filters.push(`(content ILIKE $${params.length} ESCAPE '\\' OR agent_name ILIKE $${params.length} ESCAPE '\\')`);
      }
      if (req.query.ruleId) {
        params.push(String(req.query.ruleId));
        filters.push(`rule_report -> 'violations' @> jsonb_build_array(jsonb_build_object('id', $${params.length}::text))`);
      }

      const sort = req.query.sort === 'worst' ? 'score ASC, message_sent_at DESC'
        : req.query.sort === 'best' ? 'score DESC, message_sent_at DESC'
        : 'message_sent_at DESC';

      params.push(limit, offset);
      const { rows } = await db.pool.query(`
        SELECT id, message_id, conversation_id, store_id, agent_id, agent_name,
               content, customer_prompt, rule_score, voice_score, score, grade,
               critical_count, major_count, minor_count, rule_report, ai_report,
               model, source, message_sent_at, reviewed_at,
               COUNT(*) OVER() AS total_count
          FROM qa_reviews
         WHERE ${filters.join(' AND ')}
         ORDER BY ${sort}
         LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
      res.json({
        reviews: rows.map(r => { const x = { ...r }; delete x.total_count; return x; }),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (e) { console.error('[QA] list error:', e.message); res.status(500).json({ error: e.message }); }
  });

  router.get('/reviews/:id', async (req, res) => {
    try {
      const { rows } = await db.pool.query('SELECT * FROM qa_reviews WHERE id = $1', [parseInt(req.params.id, 10)]);
      if (!rows.length) return res.status(404).json({ error: 'Review not found' });
      res.json(rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/reviews/:id', async (req, res) => {
    try {
      const { rowCount } = await db.pool.query('DELETE FROM qa_reviews WHERE id = $1', [parseInt(req.params.id, 10)]);
      if (!rowCount) return res.status(404).json({ error: 'Review not found' });
      appCache?.invalidatePrefix?.('qa:');
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Overview: headline numbers + distribution ──────────────────────────
  router.get('/overview', async (req, res) => {
    try {
      const cacheKey = `qa:overview:${JSON.stringify(req.query)}`;
      const cached = appCache?.get?.(cacheKey);
      if (cached) return res.json(cached);

      const params = [];
      const filters = windowClause(req, params);
      const where = filters.join(' AND ');

      const [summary, distribution, trend] = await Promise.all([
        db.pool.query(`
          SELECT COUNT(*)::int AS total,
                 ROUND(AVG(score)::numeric, 1) AS avg_score,
                 ROUND(AVG(rule_score)::numeric, 1) AS avg_rule_score,
                 ROUND(AVG(voice_score)::numeric, 1) AS avg_voice_score,
                 COUNT(*) FILTER (WHERE critical_count > 0)::int AS with_critical,
                 COUNT(*) FILTER (WHERE score >= 80)::int AS passing,
                 COUNT(DISTINCT agent_id)::int AS agents
            FROM qa_reviews WHERE ${where}`, params),
        db.pool.query(`
          SELECT grade, COUNT(*)::int AS n FROM qa_reviews
           WHERE ${where} GROUP BY grade ORDER BY grade`, params),
        db.pool.query(`
          SELECT date_trunc('day', message_sent_at) AS day,
                 ROUND(AVG(score)::numeric, 1) AS avg_score,
                 COUNT(*)::int AS n
            FROM qa_reviews WHERE ${where}
           GROUP BY day ORDER BY day ASC`, params),
      ]);

      const s = summary.rows[0] || {};
      const result = {
        total: s.total || 0,
        agents: s.agents || 0,
        avgScore: s.avg_score !== null && s.avg_score !== undefined ? parseFloat(s.avg_score) : null,
        avgRuleScore: s.avg_rule_score !== null && s.avg_rule_score !== undefined ? parseFloat(s.avg_rule_score) : null,
        avgVoiceScore: s.avg_voice_score !== null && s.avg_voice_score !== undefined ? parseFloat(s.avg_voice_score) : null,
        withCritical: s.with_critical || 0,
        passing: s.passing || 0,
        passRate: s.total ? Math.round((s.passing / s.total) * 100) : null,
        distribution: distribution.rows,
        trend: trend.rows.map(r => ({ day: r.day, avgScore: parseFloat(r.avg_score), n: r.n })),
      };
      appCache?.set?.(cacheKey, result, 60 * 1000);
      res.json(result);
    } catch (e) { console.error('[QA] overview error:', e.message); res.status(500).json({ error: e.message }); }
  });

  // ── Per-agent leaderboard ──────────────────────────────────────────────
  router.get('/leaderboard', async (req, res) => {
    try {
      const params = [];
      // Qualified column passed in directly. The old version built the clause
      // unqualified and then regex-replaced the table alias into it.
      const filters = windowClause(req, params, 'q.message_sent_at');
      // GROUP BY lists the three COALESCE inputs, NOT the `agent_name` output
      // alias. Postgres resolves a bare name in GROUP BY against INPUT columns
      // first, and qa_reviews has a real agent_name column — so grouping by the
      // alias silently grouped by q.agent_name and left e.employee_name and
      // e.name ungrouped. All three are functionally dependent on q.agent_id,
      // which is already in the group, so this adds no rows.
      const { rows } = await db.pool.query(`
        SELECT q.agent_id,
               COALESCE(e.employee_name, e.name, q.agent_name, 'Unknown #' || q.agent_id) AS agent_name,
               COUNT(*)::int AS reviews,
               ROUND(AVG(q.score)::numeric, 1)       AS avg_score,
               ROUND(AVG(q.rule_score)::numeric, 1)  AS avg_rule_score,
               ROUND(AVG(q.voice_score)::numeric, 1) AS avg_voice_score,
               MIN(q.score)::int AS worst_score,
               COUNT(*) FILTER (WHERE q.critical_count > 0)::int AS critical_replies,
               COUNT(*) FILTER (WHERE q.score >= 80)::int AS passing,
               MAX(q.message_sent_at) AS last_reply_at
          FROM qa_reviews q
          LEFT JOIN employees e ON e.id::text = q.agent_id
         WHERE ${filters.join(' AND ')}
         GROUP BY q.agent_id, e.employee_name, e.name, q.agent_name
         ORDER BY avg_score ASC NULLS LAST, reviews DESC
      `, params);

      res.json(rows.map(r => ({
        agentId: r.agent_id,
        agentName: r.agent_name,
        reviews: r.reviews,
        avgScore: r.avg_score !== null ? parseFloat(r.avg_score) : null,
        avgRuleScore: r.avg_rule_score !== null ? parseFloat(r.avg_rule_score) : null,
        avgVoiceScore: r.avg_voice_score !== null ? parseFloat(r.avg_voice_score) : null,
        worstScore: r.worst_score,
        criticalReplies: r.critical_replies,
        passing: r.passing,
        passRate: r.reviews ? Math.round((r.passing / r.reviews) * 100) : null,
        lastReplyAt: r.last_reply_at,
      })));
    } catch (e) { console.error('[QA] leaderboard error:', e.message); res.status(500).json({ error: e.message }); }
  });

  // ── Which rules are actually getting broken ────────────────────────────
  router.get('/violations', async (req, res) => {
    try {
      const params = [];
      const filters = windowClause(req, params);
      if (req.query.agentId) { params.push(String(req.query.agentId)); filters.push(`agent_id = $${params.length}`); }
      // Advisory rows scored zero but still topped this chart. New reports keep
      // them in `advisories`; this guard covers everything graded before that.
      const { rows } = await db.pool.query(`
        SELECT v ->> 'id'       AS rule_id,
               v ->> 'label'    AS label,
               v ->> 'severity' AS severity,
               COUNT(*)::int    AS n,
               COUNT(DISTINCT agent_id)::int AS agents
          FROM qa_reviews,
               LATERAL jsonb_array_elements(COALESCE(rule_report -> 'violations', '[]'::jsonb)) AS v
         WHERE ${filters.join(' AND ')}
           AND COALESCE(v ->> 'severity', '') <> 'info'
         GROUP BY rule_id, label, severity
         ORDER BY n DESC
      `, params);
      res.json(rows);
    } catch (e) { console.error('[QA] violations error:', e.message); res.status(500).json({ error: e.message }); }
  });

  return router;
}

module.exports = {
  createQaRoutes,
  ensureQaTables,
  runQaScan,
  evaluateForQa,
  aiVoicePass,
  startQaAutoScan,
  stopQaAutoScan,
};