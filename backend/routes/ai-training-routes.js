// ============================================================================
// AI TRAINING ROUTES
// ============================================================================

const express = require('express');
const https   = require('https');
const multer  = require('multer');
const router  = express.Router();

const { authenticateToken } = require('../auth');
const db = require('../database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/ai/training/brain
// ─────────────────────────────────────────────────────────────────────────────
router.get('/brain', authenticateToken, async (req, res) => {
  try {
    const result = await db.pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );
    if (result.rows.length === 0) return res.json({ brain: null });
    res.json({ brain: result.rows[0].brain_data });
  } catch (err) {
    console.error('[AI Training] GET brain error:', err);
    res.status(500).json({ error: 'Failed to load brain' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT  /api/ai/training/brain
// ─────────────────────────────────────────────────────────────────────────────
router.put('/brain', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { brain } = req.body;
    if (!brain || typeof brain !== 'object') return res.status(400).json({ error: 'brain object required' });

    await db.pool.query(`
      INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
      VALUES (1, $1, NOW(), $2)
      ON CONFLICT (id) DO UPDATE
        SET brain_data  = EXCLUDED.brain_data,
            updated_at  = EXCLUDED.updated_at,
            updated_by  = EXCLUDED.updated_by
    `, [JSON.stringify(brain), req.user.email]);

    try {
      const { refreshBrainCache } = require('../brain-context');
      refreshBrainCache();
    } catch { /* brain-context may not be wired yet */ }

    console.log(`[AI Training] Brain saved by ${req.user.email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AI Training] PUT brain error:', err);
    res.status(500).json({ error: 'Failed to save brain' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/upload-doc
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-doc', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { mimetype, buffer, originalname } = req.file;
    let text = '';

    if (mimetype === 'text/plain') {
      text = buffer.toString('utf-8');
    } else if (mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (
      mimetype === 'application/msword' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.match(/\.docx?$/i)
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
    }

    if (!text?.trim()) return res.status(400).json({ error: 'Could not extract text from file' });

    console.log(`[AI Training] Doc uploaded by ${req.user.email}: ${originalname} (${text.length} chars)`);
    res.json({ text: text.trim(), filename: originalname, chars: text.length });

  } catch (err) {
    console.error('[AI Training] upload-doc error:', err);
    res.status(500).json({ error: 'Failed to process document', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/extract-rules
// Dedicated rule extraction — bypasses conversational chat, saves directly
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extract-rules', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No API key' });

    const { text, filename, brain = {} } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

    const brainSummary = formatBrainForPrompt(brain);

const systemPrompt = `You extract and preserve knowledge from documents for a peptide e-commerce customer support AI brain (400+ Shopify stores, Canada + US).

This document may be a product guide, dosing protocol, FAQ, policy doc, or training material.
Your job is to extract ALL useful information — preserving detail, not summarizing it away.

CATEGORIES:
- tone: how agents should communicate
- avoid: what agents must never say or do
- prefer: what agents should always say or do
- product: peptide/product knowledge — dosing, storage, reconstitution, ingredients, effects, usage protocols, BAC water ratios, vial sizes, concentrations, cycle lengths, peptide stacks
- policy: refunds, shipping timelines, guarantees, order handling, payment, returns
- example: gold-standard reply examples

RULES FOR EXTRACTION:
- For product/policy rules: preserve FULL detail — include numbers, dosages, timeframes, temperatures, ratios
  BAD: "BPC-157 dosing information is available"
  GOOD: "BPC-157 standard dose is 250-500mcg per injection, 1-2x daily, injected subcutaneously near the site of injury"
- For tone/avoid/prefer rules: keep them concise and actionable
- Each rule must be self-contained — an agent reading it alone should understand it fully
- Extract EVERYTHING — err heavily on the side of including more rules
- Minimum 10 rules per document, no maximum
- Split compound information into separate rules for clarity
- Include brand/product names, specific SKUs, prices if mentioned

EXISTING BRAIN (skip exact duplicates only):
${brainSummary || 'Empty — extract everything'}

RESPONSE FORMAT — valid JSON only, no markdown:
{
  "rules": [
    { "category": "product", "text": "Full detailed rule text preserving all specifics", "source": "document" }
  ],
  "summary": "Extracted X rules covering: [topic list]"
}`;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Extract all rules from this${filename ? ` document (${filename})` : ' text'}:\n\n${text}` }],
    });

    const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
    const raw = response.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
    catch { parsed = { rules: [], summary: 'Could not parse extraction.' }; }

    const rules = (parsed.rules || [])
      .filter(r => r.text && r.category)
      .map(r => ({ ...r, source: filename ? 'document-upload' : 'admin-input' }));

    // Auto-save extracted rules into brain DB immediately
    if (rules.length > 0) {
      try {
        const currentResult = await db.pool.query(
          `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
        );
        const currentBrain = currentResult.rows[0]?.brain_data || {};
        const BRAIN_KEYS = {
          tone: 'toneRules', avoid: 'avoidPatterns', prefer: 'preferPatterns',
          product: 'productKnowledge', policy: 'customPolicies', example: 'responseExamples',
        };
        const updatedBrain = { ...currentBrain };
        rules.forEach(rule => {
          const key = BRAIN_KEYS[rule.category];
          if (!key) return;
          if (!updatedBrain[key]) updatedBrain[key] = [];
          const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
          if (!exists) updatedBrain[key].push({ text: rule.text, source: rule.source });
        });
        await db.pool.query(`
          INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
          VALUES (1, $1, NOW(), $2)
          ON CONFLICT (id) DO UPDATE
            SET brain_data = EXCLUDED.brain_data,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
        `, [JSON.stringify(updatedBrain), 'extract-rules-auto']);
        try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
        console.log(`[AI Training] Auto-saved ${rules.length} extracted rules to brain DB`);
      } catch (saveErr) {
        console.error('[AI Training] extract-rules auto-save error:', saveErr.message);
      }
    }

    console.log(`[AI Training] Extracted ${rules.length} rules from ${filename || 'text'}`);
    res.json({ rules, summary: parsed.summary || `Extracted ${rules.length} rules.` });

  } catch (err) {
    console.error('[AI Training] extract-rules error:', err);
    res.status(500).json({ error: 'Extraction failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/ai/training/conversation-samples?limit=20
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversation-samples', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await db.pool.query(`
      SELECT
        c.id            AS conv_id,
        c.customer_email,
        c.customer_name,
        s.brand_name    AS store,
        cm.content      AS customer_msg,
        am.content      AS agent_msg,
        cm.sent_at      AS date
      FROM conversations c
      LEFT JOIN stores s ON s.id = c.shop_id
      JOIN LATERAL (
        SELECT content, sent_at FROM messages
        WHERE conversation_id = c.id AND sender_type = 'customer'
        ORDER BY sent_at DESC LIMIT 1
      ) cm ON TRUE
      LEFT JOIN LATERAL (
        SELECT content FROM messages
        WHERE conversation_id = c.id AND sender_type = 'agent'
        ORDER BY sent_at DESC LIMIT 1
      ) am ON TRUE
      WHERE c.status IN ('open', 'closed')
        AND cm.content IS NOT NULL
        AND LENGTH(TRIM(cm.content)) > 10
      ORDER BY cm.sent_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ samples: result.rows });
  } catch (err) {
    console.error('[AI Training] conversation-samples error:', err);
    res.status(500).json({ error: 'Failed to load samples' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/auto-analyze
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auto-analyze', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No ANTHROPIC_API_KEY configured' });

    const { limit = 200, batchSize = 15 } = req.body;
    console.log(`[AI Training] Auto-analyze started by ${req.user.email} (limit=${limit})`);

    const convsResult = await db.pool.query(`
      SELECT c.id, c.customer_email, c.customer_name, s.brand_name AS store
      FROM conversations c
      LEFT JOIN stores s ON s.id = c.shop_id
      WHERE c.status IN ('open', 'closed')
      ORDER BY c.updated_at DESC
      LIMIT $1
    `, [Math.min(limit, 500)]);

    if (convsResult.rows.length === 0) {
      return res.json({ rules: [], gaps: [], totalConversations: 0, batchesProcessed: 0 });
    }

    const convIds = convsResult.rows.map(c => c.id);
    const msgsResult = await db.pool.query(`
      SELECT conversation_id, sender_type, content, sent_at
      FROM messages
      WHERE conversation_id = ANY($1) AND content IS NOT NULL AND LENGTH(TRIM(content)) > 0
      ORDER BY conversation_id, sent_at ASC
    `, [convIds]);

    const msgsByConv = {};
    msgsResult.rows.forEach(m => {
      if (!msgsByConv[m.conversation_id]) msgsByConv[m.conversation_id] = [];
      msgsByConv[m.conversation_id].push(m);
    });

    const threads = convsResult.rows
      .map(c => {
        const msgs = msgsByConv[c.id] || [];
        if (msgs.length < 2) return null;
        const thread = msgs.map(m =>
          `  [${m.sender_type === 'agent' ? 'AGENT' : 'CUSTOMER'}]: ${(m.content || '').slice(0, 300)}`
        ).join('\n');
        return `--- Conversation #${c.id} (${c.store || 'store'}) ---\n${thread}`;
      })
      .filter(Boolean);

    const BATCH_SIZE = Math.min(batchSize, 20);
    const allRules = [];
    const allGaps = [];
    const seenRules = new Set();
    const seenGaps = new Set();
    let batchesProcessed = 0;

    for (let i = 0; i < threads.length; i += BATCH_SIZE) {
      const batch = threads.slice(i, i + BATCH_SIZE);

      const systemPrompt = `You analyze customer support conversations for a peptide e-commerce business (400+ Shopify stores, Canada + US) and extract improvement rules AND knowledge gaps.

RULE CATEGORIES: tone, avoid, prefer, product, policy, example

ALSO find GAPS — topics where agent answers were vague, inconsistent, or missing info. These become interview questions for the admin.

RESPONSE FORMAT — valid JSON only, no markdown:
{
  "rules": [
    { "category": "avoid", "text": "Never ask for order number if customer already gave it", "confidence": "high" }
  ],
  "gaps": [
    { "topic": "BAC water", "question": "Is BAC water included with peptide orders? How much?", "category": "product" },
    { "topic": "refund timeline", "question": "How many days does a refund take after approval?", "category": "policy" }
  ]
}

3-8 rules per batch, 2-4 gaps per batch. Only medium/high confidence rules.`;

      try {
        const requestBody = JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Analyze these ${batch.length} conversations:\n\n${batch.join('\n\n')}` }],
        });

        const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
        const raw = response.content?.[0]?.text || '{}';
        let parsed;
        try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
        catch { parsed = { rules: [], gaps: [] }; }

        (parsed.rules || []).forEach(r => {
          if (!r.text || !r.category) return;
          const key = r.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
          if (!seenRules.has(key)) {
            seenRules.add(key);
            allRules.push({ category: r.category, text: r.text.trim(), confidence: r.confidence || 'medium', source: 'auto-analysis' });
          }
        });

        (parsed.gaps || []).forEach(g => {
          if (!g.question || !g.topic) return;
          const key = g.topic.toLowerCase().trim();
          if (!seenGaps.has(key)) {
            seenGaps.add(key);
            allGaps.push({ topic: g.topic, question: g.question, category: g.category || 'product' });
          }
        });

        batchesProcessed++;
      } catch (batchErr) {
        console.error(`[AI Training] Batch ${batchesProcessed + 1} error:`, batchErr.message);
      }

      if (i + BATCH_SIZE < threads.length) await new Promise(r => setTimeout(r, 500));
    }

    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    allRules.sort((a, b) => (confidenceOrder[a.confidence] || 1) - (confidenceOrder[b.confidence] || 1));

    console.log(`[AI Training] Done: ${allRules.length} rules, ${allGaps.length} gaps, ${batchesProcessed} batches`);
    res.json({
      rules: allRules,
      gaps: allGaps,
      totalConversations: threads.length,
      batchesProcessed,
      message: `Analyzed ${threads.length} conversations. Found ${allRules.length} rules and ${allGaps.length} knowledge gaps.`,
    });

  } catch (err) {
    console.error('[AI Training] auto-analyze error:', err);
    res.status(500).json({ error: 'Auto-analysis failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/proactive-questions
// ─────────────────────────────────────────────────────────────────────────────
router.post('/proactive-questions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No ANTHROPIC_API_KEY' });

    const { gaps = [], rules = [], brain = {} } = req.body;
    const brainSummary = formatBrainForPrompt(brain);
    const gapLines = gaps.map((g, i) => `${i + 1}. [${g.category}] ${g.topic}: ${g.question}`).join('\n');

    const systemPrompt = `You are a sharp AI trainer. You just finished analyzing customer support conversations for a peptide e-commerce business (400+ Shopify stores). You found knowledge gaps and now you need to interview the admin to fill them.

Generate 6-8 targeted questions. Each must:
- Be specific to what you found in the data
- Have 2-4 quick-reply options when there's a predictable answer set
- Include a brief hint explaining why you're asking
- Be ordered by business impact (most important first)

RESPONSE FORMAT — valid JSON only, no markdown:
{
  "intro": "Brief summary of what you found and why you need to ask admin these questions",
  "questions": [
    {
      "id": "q1",
      "text": "Question text here",
      "hint": "Why this matters — what you observed in the data",
      "category": "product|policy|tone|avoid|prefer|example",
      "quickReplies": ["Option A", "Option B", "Option C"]
    }
  ]
}`;

    const userPrompt = `I analyzed ${rules.length} patterns from conversations.

GAPS FOUND:
${gapLines || 'General gaps in product knowledge and policy communication.'}

BRAIN ALREADY KNOWS:
${brainSummary || 'Nothing yet.'}

Generate the interview.`;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
    const raw = response.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
    catch {
      parsed = {
        intro: "I found some gaps in your conversations — let me ask a few questions.",
        questions: gaps.slice(0, 6).map((g, i) => ({
          id: `q${i + 1}`, text: g.question, hint: `Observed in conversations: ${g.topic}`,
          category: g.category || 'product', quickReplies: [],
        })),
      };
    }

    res.json(parsed);
  } catch (err) {
    console.error('[AI Training] proactive-questions error:', err);
    res.status(500).json({ error: 'Failed to generate questions', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/chat
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const {
      message,
      images = [],
      history = [],
      brain: _brainFromFrontend,
      currentBrain: _legacyBrain,
      interviewContext = null,
    } = req.body;
    const currentBrain = _brainFromFrontend || _legacyBrain || {};

    if (!message && images.length === 0) return res.status(400).json({ error: 'message or images required' });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.json({ message: "No ANTHROPIC_API_KEY configured.", type: 'answer', isQuestion: false, ruleUpdates: [] });
    }

    const brainSummary = formatBrainForPrompt(currentBrain);
    const settings = currentBrain.suggestionSettings || {};
    const interviewBlock = interviewContext
      ? `\n\nCONTEXT: Admin is answering the interview question: "${interviewContext.questionText}"\nHint: ${interviewContext.hint || ''}\nExtract concrete rules from his answer. Ask one smart follow-up if needed.`
      : '';

    const lengthGuide = settings.length === 'long'
      ? '4-6 sentences per suggestion, detailed and thorough like a human expert agent'
      : settings.length === 'short'
      ? '1-2 sentences, very direct'
      : '2-4 sentences, balanced — never one-liners';

    const systemPrompt = `You are the Brain AI — the intelligence that powers AI suggestions for a peptide e-commerce customer support operation (400+ Shopify stores, Canada + US). You are talking privately with the admin.

YOUR TWO MODES:
1. ANSWER freely — product questions, support strategy, tone, policies, anything. Talk like a smart colleague.
2. LEARN actively — extract rules from what admin tells you, analyze screenshots, confirm what you've learned.

BE PROACTIVE — THIS IS CRITICAL:
- After any teaching message, always ask one specific follow-up to go deeper
- After analyzing a screenshot, ask "What would the ideal reply have been here?"
- If you notice the brain is missing critical info (dosing, refund policy, shipping times), bring it up yourself
- Ask ONE question at a time. Never list multiple questions.
- When something important is missing from the brain, say "I don't have a rule for X — how should agents handle it?"

BUSINESS CONTEXT:
- Peptides: BPC-157, TB-500, Semaglutide, Tirzepatide, CJC-1295, Ipamorelin, HGH Fragment, NAD+, GHK-Cu, Wolverine blend
- Customers ask about: dosing, reconstitution with BAC water, refrigerated storage, shipping times, tracking, order status
- English + French support (Quebec customers)
- Common issues: shipping delays, missing orders, payment failures, peptide usage questions, COA requests

SUGGESTION QUALITY SETTINGS (what agents get):
- Reply length: ${settings.length || 'medium'} — ${lengthGuide}
- Tone: ${settings.tone || 'friendly-professional'}
- Empathy level: ${settings.empathy || 'high'}
${interviewBlock}

CURRENT BRAIN:
${brainSummary || '⚠️ Empty — no rules yet. Priority to fill.'}

RULE EXTRACTION — CRITICAL, DO THIS EVERY MESSAGE:
- Read EVERY admin message for extractable facts, preferences, corrections, or instructions
- If admin states ANYTHING about how agents should behave, what products are, or what policies exist → extract it as a rule
- NEVER return empty ruleUpdates for a teaching message — if admin taught you something, it MUST appear in ruleUpdates
- type="training" → extracted rules only | type="mixed" → rules + conversational answer | type="answer" → genuinely no new info (rare)
- Tone/style instruction → "tone" | Forbidden phrases/actions → "avoid" | Must-do actions → "prefer"
- Product facts, dosing, ingredients, storage → "product" | Refunds, shipping, timelines → "policy" | Gold replies → "example"
- Short messages like "always include tracking link" or "never say sorry" are valid rules — extract them
- Extract silently — don't ask permission, just confirm: "Got it, saved as a rule."

SCREENSHOT ANALYSIS:
- Read every detail in the image
- Identify what's wrong or right with the conversation/suggestion shown
- Extract specific learnable patterns as rules
- Always ask what the ideal response should have been

RESPONSE FORMAT — valid JSON only, no markdown fences:
{
  "message": "Your response. Warm, direct, specific. Use **bold** and bullet lists when helpful.",
  "type": "answer|training|mixed|question",
  "isQuestion": true/false,
  "ruleUpdates": [
    { "category": "prefer", "text": "concrete actionable rule text", "source": "admin-feedback" }
  ],
  "nextQuestion": "One follow-up question string, or null"
}`;

    const rawMessages = [];
    history.slice(-14).forEach(h => {
      const role = h.role === 'ai' ? 'assistant' : h.role;
      if (!['user', 'assistant'].includes(role)) return;
      const content = (h.content || '').trim();
      if (!content) return;
      rawMessages.push({ role, content });
    });

    const chatMessages = [];
    for (const msg of rawMessages) {
      if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === msg.role) {
        chatMessages[chatMessages.length - 1] = msg;
      } else {
        chatMessages.push(msg);
      }
    }

    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
      chatMessages.pop();
    }

    const userContent = [];
    if (message?.trim()) userContent.push({ type: 'text', text: message });
    images.forEach(img => {
      if (img.base64 && img.type) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.base64 } });
      }
    });
    if (userContent.length === 0) userContent.push({ type: 'text', text: '(shared an image)' });
    chatMessages.push({ role: 'user', content: userContent });

    console.log(`[AI Training] Sending ${chatMessages.length} messages to Anthropic`);

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: systemPrompt,
      messages: chatMessages,
    });

    const anthropicResponse = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
    const rawContent = anthropicResponse.content?.[0]?.text || '{}';

    let parsed;
    try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
    catch { parsed = { message: rawContent, isQuestion: rawContent.includes('?'), ruleUpdates: [], type: 'answer' }; }

    const ruleUpdates = Array.isArray(parsed.ruleUpdates) ? parsed.ruleUpdates : [];

    // Auto-save chat-extracted rules to DB immediately — don't wait for frontend
    if (ruleUpdates.length > 0) {
      console.log(`[AI Training] Extracted ${ruleUpdates.length} rule(s) — auto-saving to DB`);
      try {
        const currentResult = await db.pool.query(
          `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
        );
        const currentBrainDB = currentResult.rows[0]?.brain_data || {};
        const BRAIN_KEYS = {
          tone: 'toneRules', avoid: 'avoidPatterns', prefer: 'preferPatterns',
          product: 'productKnowledge', policy: 'customPolicies', example: 'responseExamples',
        };
        const updatedBrain = { ...currentBrainDB };
        ruleUpdates.forEach(rule => {
          const key = BRAIN_KEYS[rule.category];
          if (!key) return;
          if (!updatedBrain[key]) updatedBrain[key] = [];
          const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
          if (!exists) updatedBrain[key].push({ text: rule.text, source: rule.source || 'admin-chat' });
        });
        await db.pool.query(`
          INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
          VALUES (1, $1, NOW(), $2)
          ON CONFLICT (id) DO UPDATE
            SET brain_data = EXCLUDED.brain_data,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
        `, [JSON.stringify(updatedBrain), currentBrain.email || 'chat-auto']);
        try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
      } catch (saveErr) {
        console.error('[AI Training] chat auto-save error:', saveErr.message);
      }
    }

    res.json({
      message: parsed.message || 'Tell me more.',
      type: parsed.type || (ruleUpdates.length > 0 ? 'training' : 'answer'),
      isQuestion: parsed.isQuestion ?? false,
      ruleUpdates,
      nextQuestion: parsed.nextQuestion || null,
    });

  } catch (err) {
    console.error('[AI Training] chat error:', err);
    res.status(500).json({ error: 'Training chat failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBrainForPrompt(brain) {
  if (!brain) return '';
  const txt = r => typeof r === 'string' ? r : r.text;
  const sections = [];
  if (brain.toneRules?.length)        sections.push(`TONE:\n` + brain.toneRules.map(r => `  - ${txt(r)}`).join('\n'));
  if (brain.avoidPatterns?.length)    sections.push(`AVOID:\n` + brain.avoidPatterns.map(r => `  - ${txt(r)}`).join('\n'));
  if (brain.preferPatterns?.length)   sections.push(`PREFER:\n` + brain.preferPatterns.map(r => `  - ${txt(r)}`).join('\n'));
  if (brain.productKnowledge?.length) sections.push(`PRODUCT:\n` + brain.productKnowledge.map(r => `  - ${txt(r)}`).join('\n'));
  if (brain.customPolicies?.length)   sections.push(`POLICIES:\n` + brain.customPolicies.map(r => `  - ${txt(r)}`).join('\n'));
  if (brain.responseExamples?.length) sections.push(`EXAMPLES:\n` + brain.responseExamples.map(r => `  - ${txt(r)}`).join('\n'));
  return sections.join('\n\n');
}

module.exports = router;

async function callAnthropicAPI(requestBody, apiKey) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody,
        signal: AbortSignal.timeout(60000),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);

    } catch (err) {
      const retryable = err.name === 'TimeoutError' ||
        ['ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(err.cause?.code);

      if (retryable && attempt < 2) {
        console.warn(`[AI Training] ${err.message} — retry ${attempt + 1}/2`);
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}