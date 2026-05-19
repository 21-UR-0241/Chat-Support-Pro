// // ============================================================================
// // AI TRAINING ROUTES
// // ============================================================================

// const express = require('express');
// const https   = require('https');
// const multer  = require('multer');
// const router  = express.Router();

// const { authenticateToken } = require('../auth');
// const db = require('../database');

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 10 * 1024 * 1024 },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // GET  /api/ai/training/brain
// // ─────────────────────────────────────────────────────────────────────────────
// router.get('/brain', authenticateToken, async (req, res) => {
//   try {
//     const result = await db.pool.query(
//       `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//     );
//     if (result.rows.length === 0) return res.json({ brain: null });
//     res.json({ brain: result.rows[0].brain_data });
//   } catch (err) {
//     console.error('[AI Training] GET brain error:', err);
//     res.status(500).json({ error: 'Failed to load brain' });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // PUT  /api/ai/training/brain
// // ─────────────────────────────────────────────────────────────────────────────
// router.put('/brain', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
//     const { brain } = req.body;
//     if (!brain || typeof brain !== 'object') return res.status(400).json({ error: 'brain object required' });

//     await db.pool.query(`
//       INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
//       VALUES (1, $1, NOW(), $2)
//       ON CONFLICT (id) DO UPDATE
//         SET brain_data  = EXCLUDED.brain_data,
//             updated_at  = EXCLUDED.updated_at,
//             updated_by  = EXCLUDED.updated_by
//     `, [JSON.stringify(brain), req.user.email]);

//     try {
//       const { refreshBrainCache } = require('../brain-context');
//       refreshBrainCache();
//     } catch { /* brain-context may not be wired yet */ }

//     console.log(`[AI Training] Brain saved by ${req.user.email}`);
//     res.json({ ok: true });
//   } catch (err) {
//     console.error('[AI Training] PUT brain error:', err);
//     res.status(500).json({ error: 'Failed to save brain' });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/ai/training/upload-doc
// // ─────────────────────────────────────────────────────────────────────────────
// router.post('/upload-doc', authenticateToken, upload.single('file'), async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
//     if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

//     const { mimetype, buffer, originalname } = req.file;
//     let text = '';

//     if (mimetype === 'text/plain') {
//       text = buffer.toString('utf-8');
//     } else if (mimetype === 'application/pdf') {
//       const pdfParse = require('pdf-parse');
//       const data = await pdfParse(buffer);
//       text = data.text;
//     } else if (
//       mimetype === 'application/msword' ||
//       mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
//       originalname.match(/\.docx?$/i)
//     ) {
//       const mammoth = require('mammoth');
//       const result = await mammoth.extractRawText({ buffer });
//       text = result.value;
//     } else {
//       return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
//     }

//     if (!text?.trim()) return res.status(400).json({ error: 'Could not extract text from file' });

//     console.log(`[AI Training] Doc uploaded by ${req.user.email}: ${originalname} (${text.length} chars)`);
//     res.json({ text: text.trim(), filename: originalname, chars: text.length });

//   } catch (err) {
//     console.error('[AI Training] upload-doc error:', err);
//     res.status(500).json({ error: 'Failed to process document', message: err.message });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/ai/training/extract-rules
// // Dedicated rule extraction — bypasses conversational chat, saves directly
// // NOTE: brain is intentionally NOT passed to the system prompt here.
// //       Deduplication is handled at the DB level (exists check before push).
// //       Passing the brain caused the AI to self-suppress rules for subsequent
// //       product uploads, assuming they were already covered. Extract everything,
// //       let the DB deduplicate.
// // ─────────────────────────────────────────────────────────────────────────────
// router.post('/extract-rules', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
//     const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//     if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No API key' });

//     const { text, filename } = req.body;
//     if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

//     // ── FIX: No brain summary in prompt — prevents AI from suppressing rules
//     //         on 2nd/3rd/Nth product upload. DB handles dedup automatically.
//     const systemPrompt = `You extract and preserve knowledge from documents for a peptide e-commerce customer support AI brain (400+ Shopify stores, Canada + US).

// This document may be a product guide, dosing protocol, FAQ, policy doc, or training material.
// Your job is to extract ALL useful information — preserving detail, not summarizing it away.

// CATEGORIES:
// - tone: how agents should communicate
// - avoid: what agents must never say or do
// - prefer: what agents should always say or do
// - product: peptide/product knowledge — dosing, storage, reconstitution, ingredients, effects, usage protocols, BAC water ratios, vial sizes, concentrations, cycle lengths, peptide stacks
// - policy: refunds, shipping timelines, guarantees, order handling, payment, returns
// - example: gold-standard reply examples

// RULES FOR EXTRACTION:
// - For product/policy rules: preserve FULL detail — include numbers, dosages, timeframes, temperatures, ratios
//   BAD: "BPC-157 dosing information is available"
//   GOOD: "BPC-157 standard dose is 250-500mcg per injection, 1-2x daily, injected subcutaneously near the site of injury"
// - For tone/avoid/prefer rules: keep them concise and actionable
// - Each rule must be self-contained — an agent reading it alone should understand it fully
// - Extract EVERYTHING from this document — err heavily on the side of including more rules
// - Minimum 10 rules per document, no maximum
// - Split compound information into separate rules for clarity
// - Include brand/product names, specific SKUs, prices if mentioned
// - IMPORTANT: Extract ALL rules you find in this document. Do NOT skip or omit anything.
//   Deduplication is handled automatically after extraction — your job is only to extract.

// RESPONSE FORMAT — valid JSON only, no markdown:
// {
//   "rules": [
//     { "category": "product", "text": "Full detailed rule text preserving all specifics", "source": "document" }
//   ],
//   "summary": "Extracted X rules covering: [topic list]"
// }`;

//     const requestBody = JSON.stringify({
//       model: 'claude-sonnet-4-6',
//       max_tokens: 6000,
//       system: systemPrompt,
//       messages: [{ role: 'user', content: `Extract all rules from this${filename ? ` document (${filename})` : ' text'}:\n\n${text}` }],
//     });

//     const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
//     const raw = response.content?.[0]?.text || '{}';
//     let parsed;
//     try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
//     catch { parsed = { rules: [], summary: 'Could not parse extraction.' }; }

//     const rules = (parsed.rules || [])
//       .filter(r => r.text && r.category)
//       .map(r => ({ ...r, source: filename ? 'document-upload' : 'admin-input' }));

//     // Auto-save extracted rules into brain DB immediately
//     // The exists check here is the ONLY dedup gate — AI is not involved in filtering
//     if (rules.length > 0) {
//       try {
//         const currentResult = await db.pool.query(
//           `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//         );
//         const currentBrain = currentResult.rows[0]?.brain_data || {};
//         const BRAIN_KEYS = {
//           tone: 'toneRules', avoid: 'avoidPatterns', prefer: 'preferPatterns',
//           product: 'productKnowledge', policy: 'customPolicies', example: 'responseExamples',
//         };
//         const updatedBrain = { ...currentBrain };
//         let newRulesAdded = 0;
//         rules.forEach(rule => {
//           const key = BRAIN_KEYS[rule.category];
//           if (!key) return;
//           if (!updatedBrain[key]) updatedBrain[key] = [];
//           const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
//           if (!exists) {
//             updatedBrain[key].push({ text: rule.text, source: rule.source });
//             newRulesAdded++;
//           }
//         });
//         await db.pool.query(`
//           INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
//           VALUES (1, $1, NOW(), $2)
//           ON CONFLICT (id) DO UPDATE
//             SET brain_data = EXCLUDED.brain_data,
//                 updated_at = EXCLUDED.updated_at,
//                 updated_by = EXCLUDED.updated_by
//         `, [JSON.stringify(updatedBrain), 'extract-rules-auto']);
//         try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
//         console.log(`[AI Training] Auto-saved ${newRulesAdded} new rules to brain DB (${rules.length - newRulesAdded} exact duplicates skipped)`);
//       } catch (saveErr) {
//         console.error('[AI Training] extract-rules auto-save error:', saveErr.message);
//       }
//     }

//     console.log(`[AI Training] Extracted ${rules.length} rules from ${filename || 'text'}`);
//     res.json({ rules, summary: parsed.summary || `Extracted ${rules.length} rules.` });

//   } catch (err) {
//     console.error('[AI Training] extract-rules error:', err);
//     res.status(500).json({ error: 'Extraction failed', message: err.message });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // GET  /api/ai/training/conversation-samples?limit=20
// // ─────────────────────────────────────────────────────────────────────────────
// router.get('/conversation-samples', authenticateToken, async (req, res) => {
//   try {
//     const limit = Math.min(parseInt(req.query.limit) || 20, 50);
//     const result = await db.pool.query(`
//       SELECT
//         c.id            AS conv_id,
//         c.customer_email,
//         c.customer_name,
//         s.brand_name    AS store,
//         cm.content      AS customer_msg,
//         am.content      AS agent_msg,
//         cm.sent_at      AS date
//       FROM conversations c
//       LEFT JOIN stores s ON s.id = c.shop_id
//       JOIN LATERAL (
//         SELECT content, sent_at FROM messages
//         WHERE conversation_id = c.id AND sender_type = 'customer'
//         ORDER BY sent_at DESC LIMIT 1
//       ) cm ON TRUE
//       LEFT JOIN LATERAL (
//         SELECT content FROM messages
//         WHERE conversation_id = c.id AND sender_type = 'agent'
//         ORDER BY sent_at DESC LIMIT 1
//       ) am ON TRUE
//       WHERE c.status IN ('open', 'closed')
//         AND cm.content IS NOT NULL
//         AND LENGTH(TRIM(cm.content)) > 10
//       ORDER BY cm.sent_at DESC
//       LIMIT $1
//     `, [limit]);
//     res.json({ samples: result.rows });
//   } catch (err) {
//     console.error('[AI Training] conversation-samples error:', err);
//     res.status(500).json({ error: 'Failed to load samples' });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/ai/training/auto-analyze
// // ─────────────────────────────────────────────────────────────────────────────
// router.post('/auto-analyze', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
//     const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//     if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No ANTHROPIC_API_KEY configured' });

//     const { limit = 200, batchSize = 15 } = req.body;
//     console.log(`[AI Training] Auto-analyze started by ${req.user.email} (limit=${limit})`);

//     const convsResult = await db.pool.query(`
//       SELECT c.id, c.customer_email, c.customer_name, s.brand_name AS store
//       FROM conversations c
//       LEFT JOIN stores s ON s.id = c.shop_id
//       WHERE c.status IN ('open', 'closed')
//       ORDER BY c.updated_at DESC
//       LIMIT $1
//     `, [Math.min(limit, 500)]);

//     if (convsResult.rows.length === 0) {
//       return res.json({ rules: [], gaps: [], totalConversations: 0, batchesProcessed: 0 });
//     }

//     const convIds = convsResult.rows.map(c => c.id);
//     const msgsResult = await db.pool.query(`
//       SELECT conversation_id, sender_type, content, sent_at
//       FROM messages
//       WHERE conversation_id = ANY($1) AND content IS NOT NULL AND LENGTH(TRIM(content)) > 0
//       ORDER BY conversation_id, sent_at ASC
//     `, [convIds]);

//     const msgsByConv = {};
//     msgsResult.rows.forEach(m => {
//       if (!msgsByConv[m.conversation_id]) msgsByConv[m.conversation_id] = [];
//       msgsByConv[m.conversation_id].push(m);
//     });

//     const threads = convsResult.rows
//       .map(c => {
//         const msgs = msgsByConv[c.id] || [];
//         if (msgs.length < 2) return null;
//         const thread = msgs.map(m =>
//           `  [${m.sender_type === 'agent' ? 'AGENT' : 'CUSTOMER'}]: ${(m.content || '').slice(0, 300)}`
//         ).join('\n');
//         return `--- Conversation #${c.id} (${c.store || 'store'}) ---\n${thread}`;
//       })
//       .filter(Boolean);

//     const BATCH_SIZE = Math.min(batchSize, 20);
//     const allRules = [];
//     const allGaps = [];
//     const seenRules = new Set();
//     const seenGaps = new Set();
//     let batchesProcessed = 0;

//     for (let i = 0; i < threads.length; i += BATCH_SIZE) {
//       const batch = threads.slice(i, i + BATCH_SIZE);

//       const systemPrompt = `You analyze customer support conversations for a peptide e-commerce business (400+ Shopify stores, Canada + US) and extract improvement rules AND knowledge gaps.

// RULE CATEGORIES: tone, avoid, prefer, product, policy, example

// ALSO find GAPS — topics where agent answers were vague, inconsistent, or missing info. These become interview questions for the admin.

// RESPONSE FORMAT — valid JSON only, no markdown:
// {
//   "rules": [
//     { "category": "avoid", "text": "Never ask for order number if customer already gave it", "confidence": "high" }
//   ],
//   "gaps": [
//     { "topic": "BAC water", "question": "Is BAC water included with peptide orders? How much?", "category": "product" },
//     { "topic": "refund timeline", "question": "How many days does a refund take after approval?", "category": "policy" }
//   ]
// }

// 3-8 rules per batch, 2-4 gaps per batch. Only medium/high confidence rules.`;

//       try {
//         const requestBody = JSON.stringify({
//           model: 'claude-sonnet-4-6',
//           max_tokens: 1500,
//           system: systemPrompt,
//           messages: [{ role: 'user', content: `Analyze these ${batch.length} conversations:\n\n${batch.join('\n\n')}` }],
//         });

//         const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
//         const raw = response.content?.[0]?.text || '{}';
//         let parsed;
//         try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
//         catch { parsed = { rules: [], gaps: [] }; }

//         (parsed.rules || []).forEach(r => {
//           if (!r.text || !r.category) return;
//           const key = r.text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
//           if (!seenRules.has(key)) {
//             seenRules.add(key);
//             allRules.push({ category: r.category, text: r.text.trim(), confidence: r.confidence || 'medium', source: 'auto-analysis' });
//           }
//         });

//         (parsed.gaps || []).forEach(g => {
//           if (!g.question || !g.topic) return;
//           const key = g.topic.toLowerCase().trim();
//           if (!seenGaps.has(key)) {
//             seenGaps.add(key);
//             allGaps.push({ topic: g.topic, question: g.question, category: g.category || 'product' });
//           }
//         });

//         batchesProcessed++;
//       } catch (batchErr) {
//         console.error(`[AI Training] Batch ${batchesProcessed + 1} error:`, batchErr.message);
//       }

//       if (i + BATCH_SIZE < threads.length) await new Promise(r => setTimeout(r, 500));
//     }

//     const confidenceOrder = { high: 0, medium: 1, low: 2 };
//     allRules.sort((a, b) => (confidenceOrder[a.confidence] || 1) - (confidenceOrder[b.confidence] || 1));

//     console.log(`[AI Training] Done: ${allRules.length} rules, ${allGaps.length} gaps, ${batchesProcessed} batches`);
//     res.json({
//       rules: allRules,
//       gaps: allGaps,
//       totalConversations: threads.length,
//       batchesProcessed,
//       message: `Analyzed ${threads.length} conversations. Found ${allRules.length} rules and ${allGaps.length} knowledge gaps.`,
//     });

//   } catch (err) {
//     console.error('[AI Training] auto-analyze error:', err);
//     res.status(500).json({ error: 'Auto-analysis failed', message: err.message });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/ai/training/proactive-questions
// // ─────────────────────────────────────────────────────────────────────────────
// router.post('/proactive-questions', authenticateToken, async (req, res) => {
//   try {
//     if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
//     const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//     if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No ANTHROPIC_API_KEY' });

//     const { gaps = [], rules = [], brain = {} } = req.body;
//     const brainSummary = formatBrainForPrompt(brain);
//     const gapLines = gaps.map((g, i) => `${i + 1}. [${g.category}] ${g.topic}: ${g.question}`).join('\n');

//     const systemPrompt = `You are a sharp AI trainer. You just finished analyzing customer support conversations for a peptide e-commerce business (400+ Shopify stores). You found knowledge gaps and now you need to interview the admin to fill them.

// Generate 6-8 targeted questions. Each must:
// - Be specific to what you found in the data
// - Have 2-4 quick-reply options when there's a predictable answer set
// - Include a brief hint explaining why you're asking
// - Be ordered by business impact (most important first)

// RESPONSE FORMAT — valid JSON only, no markdown:
// {
//   "intro": "Brief summary of what you found and why you need to ask admin these questions",
//   "questions": [
//     {
//       "id": "q1",
//       "text": "Question text here",
//       "hint": "Why this matters — what you observed in the data",
//       "category": "product|policy|tone|avoid|prefer|example",
//       "quickReplies": ["Option A", "Option B", "Option C"]
//     }
//   ]
// }`;

//     const userPrompt = `I analyzed ${rules.length} patterns from conversations.

// GAPS FOUND:
// ${gapLines || 'General gaps in product knowledge and policy communication.'}

// BRAIN ALREADY KNOWS:
// ${brainSummary || 'Nothing yet.'}

// Generate the interview.`;

//     const requestBody = JSON.stringify({
//       model: 'claude-sonnet-4-6',
//       max_tokens: 2500,
//       system: systemPrompt,
//       messages: [{ role: 'user', content: userPrompt }],
//     });

//     const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
//     const raw = response.content?.[0]?.text || '{}';
//     let parsed;
//     try { parsed = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
//     catch {
//       parsed = {
//         intro: "I found some gaps in your conversations — let me ask a few questions.",
//         questions: gaps.slice(0, 6).map((g, i) => ({
//           id: `q${i + 1}`, text: g.question, hint: `Observed in conversations: ${g.topic}`,
//           category: g.category || 'product', quickReplies: [],
//         })),
//       };
//     }

//     res.json(parsed);
//   } catch (err) {
//     console.error('[AI Training] proactive-questions error:', err);
//     res.status(500).json({ error: 'Failed to generate questions', message: err.message });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // POST /api/ai/training/chat
// // ─────────────────────────────────────────────────────────────────────────────
// router.post('/chat', authenticateToken, async (req, res) => {
//   try {
//     const {
//       message,
//       images = [],
//       history = [],
//       brain: _brainFromFrontend,
//       currentBrain: _legacyBrain,
//       interviewContext = null,
//     } = req.body;
//     const currentBrain = _brainFromFrontend || _legacyBrain || {};

//     if (!message && images.length === 0) return res.status(400).json({ error: 'message or images required' });

//     const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//     if (!ANTHROPIC_API_KEY) {
//       return res.json({ message: "No ANTHROPIC_API_KEY configured.", type: 'answer', isQuestion: false, ruleUpdates: [] });
//     }

//     const brainSummary = formatBrainForPrompt(currentBrain);
//     const settings = currentBrain.suggestionSettings || {};
//     const interviewBlock = interviewContext
//       ? `\n\nCONTEXT: Admin is answering the interview question: "${interviewContext.questionText}"\nHint: ${interviewContext.hint || ''}\nExtract concrete rules from his answer. Ask one smart follow-up if needed.`
//       : '';

//     const lengthGuide = settings.length === 'long'
//       ? '4-6 sentences per suggestion, detailed and thorough like a human expert agent'
//       : settings.length === 'short'
//       ? '1-2 sentences, very direct'
//       : '2-4 sentences, balanced — never one-liners';

//    const systemPrompt = `You are the Brain AI — the intelligence that powers AI suggestions for a peptide e-commerce customer support operation (400+ Shopify stores, Canada + US). You are talking privately with the admin.

// IMPORTANT — YOUR MEMORY IS REAL AND PERSISTENT:
// - You have a live PostgreSQL database. Every rule in "CURRENT BRAIN" below was saved there by a previous session.
// - When you return ruleUpdates in your JSON response, the system AUTOMATICALLY saves them to the database immediately — no developer needed, no copy-pasting.
// - You are NOT a stateless chatbot. You DO persist information between sessions.
// - When admin uploads a document or teaches you something, it IS being permanently saved right now.
// - Never tell the admin that rules need to be manually added by a developer. They don't. It's automatic.
// - Never suggest the admin needs to "copy-paste" rules anywhere. The pipeline is fully automated.
// - If asked "did that save?", confirm yes — rules returned in ruleUpdates are written to the DB before your response even reaches the admin.

// YOUR TWO MODES:
// 1. ANSWER freely — product questions, support strategy, tone, policies, anything. Talk like a smart colleague.
// 2. LEARN actively — extract rules from what admin tells you, analyze screenshots, confirm what you've learned.

// BE PROACTIVE — THIS IS CRITICAL:
// - After any teaching message, always ask one specific follow-up to go deeper
// - After analyzing a screenshot, ask "What would the ideal reply have been here?"
// - If you notice the brain is missing critical info (dosing, refund policy, shipping times), bring it up yourself
// - Ask ONE question at a time. Never list multiple questions.
// - When something important is missing from the brain, say "I don't have a rule for X — how should agents handle it?"

// BUSINESS CONTEXT:
// - Peptides: BPC-157, TB-500, Semaglutide, Tirzepatide, CJC-1295, Ipamorelin, HGH Fragment, NAD+, GHK-Cu, Wolverine blend
// - Customers ask about: dosing, reconstitution with BAC water, refrigerated storage, shipping times, tracking, order status
// - English + French support (Quebec customers)
// - Common issues: shipping delays, missing orders, payment failures, peptide usage questions, COA requests

// SUGGESTION QUALITY SETTINGS (what agents get):
// - Reply length: ${settings.length || 'medium'} — ${lengthGuide}
// - Tone: ${settings.tone || 'friendly-professional'}
// - Empathy level: ${settings.empathy || 'high'}
// ${interviewBlock}

// CURRENT BRAIN:
// ${brainSummary || '⚠️ Empty — no rules yet. Priority to fill.'}

// RULE EXTRACTION — CRITICAL, DO THIS EVERY MESSAGE:
// - Read EVERY admin message for extractable facts, preferences, corrections, or instructions
// - If admin states ANYTHING about how agents should behave, what products are, or what policies exist → extract it as a rule
// - NEVER return empty ruleUpdates for a teaching message — if admin taught you something, it MUST appear in ruleUpdates
// - type="training" → extracted rules only | type="mixed" → rules + conversational answer | type="answer" → genuinely no new info (rare)
// - Tone/style instruction → "tone" | Forbidden phrases/actions → "avoid" | Must-do actions → "prefer"
// - Product facts, dosing, ingredients, storage → "product" | Refunds, shipping, timelines → "policy" | Gold replies → "example"
// - Short messages like "always include tracking link" or "never say sorry" are valid rules — extract them
// - Extract silently — don't ask permission, just confirm: "Got it, saved as a rule."

// SCREENSHOT ANALYSIS:
// - Read every detail in the image
// - Identify what's wrong or right with the conversation/suggestion shown
// - Extract specific learnable patterns as rules
// - Always ask what the ideal response should have been

// RESPONSE FORMAT — valid JSON only, no markdown fences:
// {
//   "message": "Your response. Warm, direct, specific. Use **bold** and bullet lists when helpful.",
//   "type": "answer|training|mixed|question",
//   "isQuestion": true/false,
//   "ruleUpdates": [
//     { "category": "prefer", "text": "concrete actionable rule text", "source": "admin-feedback" }
//   ],
//   "nextQuestion": "One follow-up question string, or null"
// }`;

//     const rawMessages = [];
//     history.slice(-14).forEach(h => {
//       const role = h.role === 'ai' ? 'assistant' : h.role;
//       if (!['user', 'assistant'].includes(role)) return;
//       const content = (h.content || '').trim();
//       if (!content) return;
//       rawMessages.push({ role, content });
//     });

//     const chatMessages = [];
//     for (const msg of rawMessages) {
//       if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === msg.role) {
//         chatMessages[chatMessages.length - 1] = msg;
//       } else {
//         chatMessages.push(msg);
//       }
//     }

//     if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
//       chatMessages.pop();
//     }

//     const userContent = [];
//     if (message?.trim()) userContent.push({ type: 'text', text: message });
//     images.forEach(img => {
//       if (img.base64 && img.type) {
//         userContent.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.base64 } });
//       }
//     });
//     if (userContent.length === 0) userContent.push({ type: 'text', text: '(shared an image)' });
//     chatMessages.push({ role: 'user', content: userContent });

//     console.log(`[AI Training] Sending ${chatMessages.length} messages to Anthropic`);

//     const requestBody = JSON.stringify({
//       model: 'claude-sonnet-4-6',
//       max_tokens: 2500,
//       system: systemPrompt,
//       messages: chatMessages,
//     });

//     const anthropicResponse = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
//     const rawContent = anthropicResponse.content?.[0]?.text || '{}';

//     let parsed;
//     try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
//     catch { parsed = { message: rawContent, isQuestion: rawContent.includes('?'), ruleUpdates: [], type: 'answer' }; }

//     const ruleUpdates = Array.isArray(parsed.ruleUpdates) ? parsed.ruleUpdates : [];

//     // Auto-save chat-extracted rules to DB immediately — don't wait for frontend
//     if (ruleUpdates.length > 0) {
//       console.log(`[AI Training] Extracted ${ruleUpdates.length} rule(s) — auto-saving to DB`);
//       try {
//         const currentResult = await db.pool.query(
//           `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//         );
//         const currentBrainDB = currentResult.rows[0]?.brain_data || {};
//         const BRAIN_KEYS = {
//           tone: 'toneRules', avoid: 'avoidPatterns', prefer: 'preferPatterns',
//           product: 'productKnowledge', policy: 'customPolicies', example: 'responseExamples',
//         };
//         const updatedBrain = { ...currentBrainDB };
//         ruleUpdates.forEach(rule => {
//           const key = BRAIN_KEYS[rule.category];
//           if (!key) return;
//           if (!updatedBrain[key]) updatedBrain[key] = [];
//           const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
//           if (!exists) updatedBrain[key].push({ text: rule.text, source: rule.source || 'admin-chat' });
//         });
//         await db.pool.query(`
//           INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
//           VALUES (1, $1, NOW(), $2)
//           ON CONFLICT (id) DO UPDATE
//             SET brain_data = EXCLUDED.brain_data,
//                 updated_at = EXCLUDED.updated_at,
//                 updated_by = EXCLUDED.updated_by
//         `, [JSON.stringify(updatedBrain), currentBrain.email || 'chat-auto']);
//         try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
//       } catch (saveErr) {
//         console.error('[AI Training] chat auto-save error:', saveErr.message);
//       }
//     }

//     res.json({
//       message: parsed.message || 'Tell me more.',
//       type: parsed.type || (ruleUpdates.length > 0 ? 'training' : 'answer'),
//       isQuestion: parsed.isQuestion ?? false,
//       ruleUpdates,
//       nextQuestion: parsed.nextQuestion || null,
//     });

//   } catch (err) {
//     console.error('[AI Training] chat error:', err);
//     res.status(500).json({ error: 'Training chat failed', message: err.message });
//   }
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// function formatBrainForPrompt(brain) {
//   if (!brain) return '';
//   const txt = r => typeof r === 'string' ? r : r.text;
//   const sections = [];
//   if (brain.toneRules?.length)        sections.push(`TONE:\n` + brain.toneRules.map(r => `  - ${txt(r)}`).join('\n'));
//   if (brain.avoidPatterns?.length)    sections.push(`AVOID:\n` + brain.avoidPatterns.map(r => `  - ${txt(r)}`).join('\n'));
//   if (brain.preferPatterns?.length)   sections.push(`PREFER:\n` + brain.preferPatterns.map(r => `  - ${txt(r)}`).join('\n'));
//   if (brain.productKnowledge?.length) sections.push(`PRODUCT:\n` + brain.productKnowledge.map(r => `  - ${txt(r)}`).join('\n'));
//   if (brain.customPolicies?.length)   sections.push(`POLICIES:\n` + brain.customPolicies.map(r => `  - ${txt(r)}`).join('\n'));
//   if (brain.responseExamples?.length) sections.push(`EXAMPLES:\n` + brain.responseExamples.map(r => `  - ${txt(r)}`).join('\n'));
//   return sections.join('\n\n');
// }

// module.exports = router;

// async function callAnthropicAPI(requestBody, apiKey) {
//   for (let attempt = 0; attempt <= 2; attempt++) {
//     try {
//       const res = await fetch('https://api.anthropic.com/v1/messages', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'x-api-key': apiKey,
//           'anthropic-version': '2023-06-01',
//         },
//         body: requestBody,
//         signal: AbortSignal.timeout(60000),
//       });

//       const text = await res.text();
//       if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
//       return JSON.parse(text);

//     } catch (err) {
//       const retryable = err.name === 'TimeoutError' ||
//         ['ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(err.cause?.code);

//       if (retryable && attempt < 2) {
//         console.warn(`[AI Training] ${err.message} — retry ${attempt + 1}/2`);
//         await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
//         continue;
//       }
//       throw err;
//     }
//   }
// }




const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const { authenticateToken } = require('../auth');
const db = require('../database');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/training/brain
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
// PUT /api/ai/training/brain
// ─────────────────────────────────────────────────────────────────────────────
router.put('/brain', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { brain } = req.body;
    if (!brain || typeof brain !== 'object') return res.status(400).json({ error: 'brain object required' });
    await backupBrain('pre-manual-edit', req.user.email);

    await db.pool.query(`
      INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
      VALUES (1, $1, NOW(), $2)
      ON CONFLICT (id) DO UPDATE
        SET brain_data = EXCLUDED.brain_data,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
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
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extract-rules', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No API key' });

    const { text, filename } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

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
- Extract EVERYTHING from this document — err heavily on the side of including more rules
- Minimum 10 rules per document, no maximum
- Split compound information into separate rules for clarity
- Include brand/product names, specific SKUs, prices if mentioned
- Deduplication is handled automatically after extraction — your job is only to extract.

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
    const parsed = parseAIResponse(raw) || { rules: [], summary: 'Could not parse extraction.' };

    const rules = (parsed.rules || [])
      .filter(r => r.text && r.category)
      .map(r => ({ ...r, source: filename ? 'document-upload' : 'admin-input' }));

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
        let newRulesAdded = 0;
        rules.forEach(rule => {
          const key = BRAIN_KEYS[rule.category];
          if (!key) return;
          if (!updatedBrain[key]) updatedBrain[key] = [];
          const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
          if (!exists) {
            updatedBrain[key].push({ text: rule.text, source: rule.source });
            newRulesAdded++;
          }
        });

        await backupBrain('pre-doc-extract', req.user.email);


        await db.pool.query(`
          INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
          VALUES (1, $1, NOW(), $2)
          ON CONFLICT (id) DO UPDATE
            SET brain_data = EXCLUDED.brain_data,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
        `, [JSON.stringify(updatedBrain), 'extract-rules-auto']);
        try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
        console.log(`[AI Training] Auto-saved ${newRulesAdded} new rules (${rules.length - newRulesAdded} dupes skipped)`);
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
// GET /api/ai/training/conversation-samples
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
        const parsed = parseAIResponse(raw) || { rules: [], gaps: [] };

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

    const { gaps = [], rules = [] } = req.body;

    const brain = await loadBrainFromDB();
    const brainSummary = formatBrainForPromptBudgeted(brain, 8000);
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
      max_tokens: 2500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const response = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
    const raw = response.content?.[0]?.text || '{}';
    const parsed = parseAIResponse(raw) || {
      intro: "I found some gaps in your conversations — let me ask a few questions.",
      questions: gaps.slice(0, 6).map((g, i) => ({
        id: `q${i + 1}`, text: g.question, hint: `Observed in conversations: ${g.topic}`,
        category: g.category || 'product', quickReplies: [],
      })),
    };

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
    const { message, images = [], history = [], interviewContext = null } = req.body;

    if (!message && images.length === 0) return res.status(400).json({ error: 'message or images required' });

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.json({ message: "No ANTHROPIC_API_KEY configured.", type: 'answer', isQuestion: false, ruleUpdates: [] });
    }

    // SOURCE OF TRUTH: always pull brain from DB. Never trust frontend payload —
    // a stale or empty brain from frontend used to short-circuit this fetch and
    // make the AI claim "I don't have access to the rules".
    const currentBrain = await loadBrainFromDB();
    const brainCounts = countBrainRules(currentBrain);
    const totalRules = Object.values(brainCounts).reduce((s, n) => s + n, 0);

    // Detect meta-queries that want a wide view ("what rules do you know",
    // "list all", "show me everything", etc). For these, raise the per-category
    // recency cap so the AI sees as much as the budget allows.
    const userText = `${message || ''}`;
    const isMetaQuery = /\b(all|every|everything|entire|full|list|show|know)\b.*\b(rules?|brain|memory|saved|have|stored)\b/i.test(userText)
                     || /\b(rules?|brain|memory)\b.*\b(all|every|everything|list)\b/i.test(userText)
                     || /^(what.*you.*know|what.*your.*brain|do you have rules)/i.test(userText.trim());

    const recencyPerCategory = isMetaQuery ? 100 : 30;
    const brainSummary = formatBrainForPromptBudgeted(currentBrain, 20000, recencyPerCategory);

    // RELEVANCE PASS — surface rules matching the admin's current question.
    const lastUserHistory = [...history].reverse().find(h => h.role === 'user')?.content || '';
    const searchQuery = `${message || ''} ${lastUserHistory}`.slice(0, 1500);
    const relevantRules = searchBrainRules(currentBrain, searchQuery, { perCategory: 10, totalCap: 40 });
    const relevantBlock = formatRelevantRules(relevantRules);
    const relevantHits = Object.values(relevantRules).reduce((s, arr) => s + arr.length, 0);

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

IMPORTANT — YOU HAVE FULL ACCESS TO YOUR BRAIN. DO NOT CLAIM OTHERWISE:
- The brain in this prompt is the complete, current state of your knowledge. It was loaded from the live database for this exact request.
- Total rules currently in your brain: ${totalRules} (TONE ${brainCounts.tone}, AVOID ${brainCounts.avoid}, PREFER ${brainCounts.prefer}, PRODUCT ${brainCounts.product}, POLICY ${brainCounts.policy}, EXAMPLE ${brainCounts.example}).
- NEVER say "I don't have access to the rules", "I can't see your rules", "the rules are in a database I can't query", or anything similar. You CAN see them — they are right below.
- If the brain is empty (0 rules), say so plainly: "Your brain is empty — no rules saved yet." Do not phrase this as access denial.
- If admin asks about a specific topic and no matching rule appears below, say: "I don't have a rule about X yet" — not "I can't access the rules."

YOUR MEMORY IS REAL AND PERSISTENT:
- Every rule you return in ruleUpdates gets AUTOMATICALLY saved to the PostgreSQL database before this response reaches the admin. No developer, no copy-pasting.
- You are NOT stateless. Rules persist across sessions.
- If admin asks "did that save?", confirm yes — rules in ruleUpdates are written immediately.

YOUR TWO MODES:
1. ANSWER freely — product questions, support strategy, tone, policies, anything. Talk like a smart colleague.
2. LEARN actively — extract rules from what admin tells you, analyze screenshots, confirm what you've learned.

BE PROACTIVE:
- After any teaching message, ask one specific follow-up to go deeper
- After analyzing a screenshot, ask "What would the ideal reply have been here?"
- If a critical area is empty (dosing, refund policy, shipping times), bring it up
- ONE question at a time. Never list multiple questions.

BUSINESS CONTEXT:
- Peptides: BPC-157, TB-500, Semaglutide, Tirzepatide, Retatrutide, CJC-1295, Ipamorelin, HGH Fragment, NAD+, GHK-Cu, Wolverine blend
- Customers ask about: dosing, reconstitution with BAC water, refrigerated storage, shipping times, tracking, order status
- English + French support (Quebec customers)
- Common issues: shipping delays, missing orders, payment failures, peptide usage questions, COA requests

SUGGESTION QUALITY SETTINGS (what agents get):
- Reply length: ${settings.length || 'medium'} — ${lengthGuide}
- Tone: ${settings.tone || 'friendly-professional'}
- Empathy level: ${settings.empathy || 'high'}
${interviewBlock}

═══════════════════════════════════════════════════════════════
YOUR BRAIN (loaded fresh from DB for this request):
═══════════════════════════════════════════════════════════════
${brainSummary || '⚠️ EMPTY BRAIN — zero rules saved. Tell admin plainly: "Your brain is empty — no rules saved yet. Let\'s fix that."'}

${relevantBlock ? `═══════════════════════════════════════════════════════════════\n${relevantBlock}\n═══════════════════════════════════════════════════════════════\n\nThe "RULES RELEVANT" block above is the AUTHORITATIVE source for the admin's current question. Quote it accurately, follow its constraints, and don't contradict it.\n` : ''}

RULE EXTRACTION — DO THIS EVERY MESSAGE:
- Read EVERY admin message for extractable facts, preferences, corrections, instructions
- If admin states ANYTHING about how agents should behave, what products are, what policies exist → extract as a rule
- NEVER return empty ruleUpdates for a teaching message
- type="training" → extracted rules only | "mixed" → rules + answer | "answer" → no new info (rare)
- Tone/style → "tone" | Forbidden → "avoid" | Must-do → "prefer"
- Product/dosing/storage → "product" | Refunds/shipping/timelines → "policy" | Gold replies → "example"
- Short messages like "always include tracking link" are valid rules — extract them
- Extract silently: "Got it, saved as a rule."

═══════════════════════════════════════════════════════════════
RULE OUTPUT DISCIPLINE — STRICT:
═══════════════════════════════════════════════════════════════
- Rules go ONLY in the ruleUpdates array. NEVER show rule JSON, "MASTER RULE" blocks, or raw { "category": ..., "text": ... } syntax inside the message field.
- The message field is conversational prose. The admin sees ruleUpdates rendered as cards in the UI automatically.
- If you've extracted 6 rules, message says: "Got it — saved 6 rules covering refunds and tracking. Want me to lock in the BAC-water defaults too?"
- Hard cap: message field stays under 1500 characters unless admin explicitly asks for a long explanation.
═══════════════════════════════════════════════════════════════

SCREENSHOT ANALYSIS:
- Read every detail in the image
- Identify what's wrong or right with the conversation/suggestion shown
- Extract specific learnable patterns as rules
- Always ask what the ideal response should have been

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT — CRITICAL:
═══════════════════════════════════════════════════════════════
Your ENTIRE response is ONE JSON object. The admin sees ONLY the "message" field — everything else is invisible to them. There is no preamble, no postamble, no prose before or after the JSON. The first character of your response is "{" and the last character is "}".

Wrong (what NOT to do):
  Here's everything I know about BPC-157:
  Reconstitution: 1mL BAC water...
  {"message": "Here's everything about BPC-157", ...}

Right:
  {"message": "Here's everything I know about BPC-157:\\n\\nReconstitution: 1mL BAC water...", ...}

The "message" field holds the FULL response shown to admin. If admin asks for a detailed dump (BPC-157 protocol, list all rules, etc.), the full detail goes INSIDE "message" — use \\n for line breaks. Length is whatever the admin needs: short for casual chat, long for info dumps. The 1500-char cap from rule output discipline does NOT apply to genuine info requests where admin asked for detail.

JSON SHAPE — no markdown fences, no code blocks, just the object:
{
  "message": "The complete response admin sees. Can be one sentence or many paragraphs. Use \\n for line breaks within the string.",
  "type": "answer|training|mixed|question",
  "isQuestion": true/false,
  "ruleUpdates": [
    { "category": "prefer", "text": "concrete actionable rule text", "source": "admin-feedback" }
  ],
  "nextQuestion": "One follow-up question string, or null"
}`;

    // BYTE-BUDGETED HISTORY
    const MAX_HISTORY_CHARS = 25000;
    let historyBudget = MAX_HISTORY_CHARS;
    let droppedCount = 0;
    const rawMessages = [];
    for (const h of [...history].reverse().slice(0, 14)) {
      const role = h.role === 'ai' ? 'assistant' : h.role;
      if (!['user', 'assistant'].includes(role)) continue;
      const content = (h.content || '').trim();
      if (!content) continue;
      if (content.length > historyBudget) { droppedCount++; continue; }
      rawMessages.unshift({ role, content });
      historyBudget -= content.length;
    }
    if (droppedCount > 0) {
      console.log(`[AI Training] Dropped ${droppedCount} oversized history message(s)`);
    }

    // Collapse consecutive same-role messages
    const chatMessages = [];
    for (const msg of rawMessages) {
      if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === msg.role) {
        chatMessages[chatMessages.length - 1] = msg;
      } else {
        chatMessages.push(msg);
      }
    }

    // Pop trailing user — we're about to add the new one below
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'user') {
      chatMessages.pop();
    }

    // Build current user message (text + images)
    const userContent = [];
    if (message?.trim()) userContent.push({ type: 'text', text: message });
    images.forEach(img => {
      if (img.base64 && img.type) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.base64 } });
      }
    });
    if (userContent.length === 0) userContent.push({ type: 'text', text: '(shared an image)' });
    chatMessages.push({ role: 'user', content: userContent });

    console.log(`[AI Training] chat: brain=${totalRules}r (${JSON.stringify(brainCounts)}) summary=${brainSummary.length}c relevant=${relevantHits}r/${relevantBlock.length}c meta=${isMetaQuery} msgs=${chatMessages.length}`);

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: systemPrompt,
      messages: chatMessages,
    });

    const anthropicResponse = await callAnthropicAPI(requestBody, ANTHROPIC_API_KEY);
    const rawContent = anthropicResponse.content?.[0]?.text || '{}';

const parsed = parseAIResponse(rawContent) || {
      message: rawContent,
      isQuestion: rawContent.includes('?'),
      ruleUpdates: [],
      type: 'answer'
    };

    const ruleUpdates = Array.isArray(parsed.ruleUpdates) ? parsed.ruleUpdates : [];

    // Auto-save chat-extracted rules to DB immediately
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
        let actuallyAdded = 0;
        ruleUpdates.forEach(rule => {
          const key = BRAIN_KEYS[rule.category];
          if (!key) return;
          if (!updatedBrain[key]) updatedBrain[key] = [];
          const exists = updatedBrain[key].some(r => (r.text || r) === rule.text);
          if (!exists) {
            updatedBrain[key].push({ text: rule.text, source: rule.source || 'admin-chat' });
            actuallyAdded++;
          }
        });

        // Backup before writing — skip if nothing new actually added (all dupes),
        // skip if just 1-2 trickle rules, OR if a backup ran in the last 10 min.
        if (actuallyAdded >= 3) {
          await backupBrain('pre-chat-save', req.user?.email || 'chat-auto', { minIntervalMinutes: 10 });
        }

        await db.pool.query(`
          INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
          VALUES (1, $1, NOW(), $2)
          ON CONFLICT (id) DO UPDATE
            SET brain_data = EXCLUDED.brain_data,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
        `, [JSON.stringify(updatedBrain), req.user?.email || 'chat-auto']);
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
// GET /api/ai/training/brain-search?q=...
// Debug endpoint — preview what the chat would see for a given query.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/brain-search', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const q = req.query.q || '';
    if (!q.trim()) return res.status(400).json({ error: 'q query param required' });

    const brain = await loadBrainFromDB();
    const perCategory = Math.min(parseInt(req.query.perCategory) || 10, 25);
    const totalCap    = Math.min(parseInt(req.query.totalCap)    || 40, 100);

    const tokens   = tokenizeQuery(q);
    const matched  = searchBrainRules(brain, q, { perCategory, totalCap });
    const totalHits = Object.values(matched).reduce((s, arr) => s + arr.length, 0);
    const counts   = countBrainRules(brain);

    res.json({ query: q, tokens, brainCounts: counts, totalHits, perCategory, totalCap, matched });
  } catch (err) {
    console.error('[AI Training] brain-search error:', err);
    res.status(500).json({ error: 'Search failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/consolidate
// Body: { categories?: ['product','policy',...], dryRun?: boolean, verify?: boolean }
// Default: all categories, no dryRun, no verify (verify adds ~2x API cost).
// Topic-clusters first, then consolidates within each cluster. Backs up brain.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/consolidate', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(400).json({ error: 'No ANTHROPIC_API_KEY' });

    const { categories = null, dryRun = false, verify = false } = req.body;
    const ALL_KEYS = {
      tone: 'toneRules', avoid: 'avoidPatterns', prefer: 'preferPatterns',
      product: 'productKnowledge', policy: 'customPolicies', example: 'responseExamples',
    };
    const target = Array.isArray(categories) && categories.length
      ? categories.filter(c => ALL_KEYS[c])
      : Object.keys(ALL_KEYS);

    const brain = await loadBrainFromDB();
    const newBrain = { ...brain };
    const report = {};

    for (const cat of target) {
      const key = ALL_KEYS[cat];
      const arr = (brain[key] || []).map(r => (typeof r === 'string' ? { text: r } : r));
      if (arr.length < 2) {
        report[cat] = { before: arr.length, after: arr.length, action: 'skipped (< 2 rules)' };
        continue;
      }
      const result = await consolidateCategoryDeep(cat, arr, ANTHROPIC_API_KEY, { verify });
      if (!result || !result.rules.length || result.rules.length >= arr.length) {
        report[cat] = { before: arr.length, after: arr.length, action: 'no merge possible', clusters: result?.clusters };
        continue;
      }
      newBrain[key] = result.rules.map(text => ({ text, source: 'consolidated' }));
      report[cat] = {
        before: arr.length,
        after: result.rules.length,
        saved: arr.length - result.rules.length,
        clusters: result.clusters,
        recoveredDetails: result.lostInfo || [],
      };
    }

    if (dryRun) {
      return res.json({ dryRun: true, report, proposedCounts: countBrainRules(newBrain) });
    }

    // Backup before replacing
    try {
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS ai_training_brain_backups (
          id SERIAL PRIMARY KEY,
          brain_data JSONB NOT NULL,
          backed_up_at TIMESTAMPTZ DEFAULT NOW(),
          reason TEXT,
          backed_up_by TEXT
        )
      `);
      await db.pool.query(
        `INSERT INTO ai_training_brain_backups (brain_data, reason, backed_up_by) VALUES ($1, $2, $3)`,
        [JSON.stringify(brain), 'pre-consolidate', req.user.email]
      );
    } catch (bErr) {
      console.error('[AI Training] consolidate backup failed:', bErr.message);
    }

    await db.pool.query(`
      INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
      VALUES (1, $1, NOW(), $2)
      ON CONFLICT (id) DO UPDATE
        SET brain_data = EXCLUDED.brain_data,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
    `, [JSON.stringify(newBrain), `consolidate-${req.user.email}`]);

    try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}

    console.log(`[AI Training] Consolidate by ${req.user.email}:`, JSON.stringify(report));
    res.json({ ok: true, report, brainCounts: countBrainRules(newBrain) });

  } catch (err) {
    console.error('[AI Training] consolidate error:', err);
    res.status(500).json({ error: 'Consolidation failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/training/consolidate-restore — undo the most recent consolidate
// ─────────────────────────────────────────────────────────────────────────────
router.post('/consolidate-restore', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const r = await db.pool.query(
      `SELECT brain_data, backed_up_at FROM ai_training_brain_backups ORDER BY backed_up_at DESC LIMIT 1`
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No backup found' });

    await db.pool.query(`
      INSERT INTO ai_training_brain (id, brain_data, updated_at, updated_by)
      VALUES (1, $1, NOW(), $2)
      ON CONFLICT (id) DO UPDATE
        SET brain_data = EXCLUDED.brain_data,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
    `, [JSON.stringify(r.rows[0].brain_data), `restore-${req.user.email}`]);

    try { const { refreshBrainCache } = require('../brain-context'); refreshBrainCache(); } catch {}
    res.json({
      ok: true,
      restoredFrom: r.rows[0].backed_up_at,
      brainCounts: countBrainRules(r.rows[0].brain_data),
    });
  } catch (err) {
    console.error('[AI Training] consolidate-restore error:', err);
    res.status(500).json({ error: 'Restore failed', message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════

function parseAIResponse(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Strict parse first
  try { return JSON.parse(cleaned); } catch {}
  // Fallback: find the last { ... } block in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}\s*$/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}

async function loadBrainFromDB() {
  try {
    const r = await db.pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );
    return r.rows[0]?.brain_data || {};
  } catch (err) {
    console.error('[AI Training] loadBrainFromDB error:', err.message);
    return {};
  }
}

async function backupBrain(reason, userEmail, { minIntervalMinutes = 0 } = {}) {
  try {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS ai_training_brain_backups (
        id SERIAL PRIMARY KEY,
        brain_data JSONB NOT NULL,
        backed_up_at TIMESTAMPTZ DEFAULT NOW(),
        reason TEXT,
        backed_up_by TEXT
      )
    `);

    if (minIntervalMinutes > 0) {
      const recent = await db.pool.query(
        `SELECT 1 FROM ai_training_brain_backups
         WHERE backed_up_at > NOW() - INTERVAL '1 minute' * $1
         LIMIT 1`,
        [minIntervalMinutes]
      );
      if (recent.rows.length > 0) return;
    }

    const current = await db.pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );
    if (current.rows[0]?.brain_data) {
      await db.pool.query(
        `INSERT INTO ai_training_brain_backups (brain_data, reason, backed_up_by) VALUES ($1, $2, $3)`,
        [JSON.stringify(current.rows[0].brain_data), reason, userEmail]
      );
    }
  } catch (err) {
    console.error('[AI Training] backupBrain error:', err.message);
  }
}

function countBrainRules(brain) {
  return {
    tone:    (brain?.toneRules        || []).length,
    avoid:   (brain?.avoidPatterns    || []).length,
    prefer:  (brain?.preferPatterns   || []).length,
    product: (brain?.productKnowledge || []).length,
    policy:  (brain?.customPolicies   || []).length,
    example: (brain?.responseExamples || []).length,
  };
}

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

function formatBrainForPromptBudgeted(brain, maxChars = 20000, perCategory = 30) {
  if (!brain) return '';
  const txt = r => typeof r === 'string' ? r : r.text;
  const KEYS = [
    ['TONE',     'toneRules'],
    ['AVOID',    'avoidPatterns'],
    ['PREFER',   'preferPatterns'],
    ['PRODUCT',  'productKnowledge'],
    ['POLICIES', 'customPolicies'],
    ['EXAMPLES', 'responseExamples'],
  ];
  const counts = KEYS.map(([label, key]) =>
    `${label} ${(brain[key] || []).length}`).join(' · ');
  const total = KEYS.reduce((s, [, k]) => s + (brain[k] || []).length, 0);
  if (total === 0) return '';

  const header = `TOTALS: ${counts}\n(Showing ${perCategory}+ most recent per category. Additional matching rules surface in the RELEVANT block via keyword search.)\n\n`;
  let budget = maxChars - header.length;
  const sections = [];
  for (const [label, key] of KEYS) {
    const arr = brain[key] || [];
    if (!arr.length) continue;
    const recent = arr.slice(-perCategory);
    const section = `${label}:\n${recent.map(r => `  - ${txt(r)}`).join('\n')}`;
    if (section.length > budget) {
      const partial = `${label}:\n${recent.map(r => `  - ${txt(r)}`).join('\n').slice(0, Math.max(0, budget - label.length - 20))}\n  - [... truncated, ${arr.length} total]`;
      sections.push(partial);
      break;
    }
    sections.push(section);
    budget -= section.length + 2;
  }
  return header + sections.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword relevance search
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_STOPWORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','should','could','can',
  'may','might','of','at','by','for','with','about','as','into','through',
  'to','from','up','down','in','out','on','off','over','under','again',
  'here','there','when','where','why','how','what','which','who','whom',
  'this','that','these','those','i','me','my','we','our','you','your',
  'he','him','his','she','her','it','its','they','them','their',
  'just','also','still','really','very','quite','pretty','always','never',
  'hi','hey','hello','thanks','please','okay','ok','yes','no','yeah','nope',
  'tell','show','give','want','need','think','make',
  'something','anything','everything','nothing','keep','going','more','some',
  'say','says','said','one','two','three','first','last',
]);

const PEPTIDE_ALIASES = {
  reta: 'retatrutide', tirz: 'tirzepatide', sema: 'semaglutide',
  bpc: 'bpc-157', tb: 'tb-500', cjc: 'cjc-1295', ipa: 'ipamorelin',
  ghk: 'ghk-cu', tesa: 'tesamorelin', nad: 'nad+', glp: 'semaglutide',
};

function tokenizeQuery(query) {
  const raw = (query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !SEARCH_STOPWORDS.has(w));

  const expanded = new Set(raw);
  for (const t of raw) {
    if (PEPTIDE_ALIASES[t]) expanded.add(PEPTIDE_ALIASES[t]);
  }
  return [...expanded];
}

function searchBrainRules(brain, query, { perCategory = 8, totalCap = 30 } = {}) {
  if (!brain || !query) return {};
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return {};

  const KEYS = {
    tone:    'toneRules',
    avoid:   'avoidPatterns',
    prefer:  'preferPatterns',
    product: 'productKnowledge',
    policy:  'customPolicies',
    example: 'responseExamples',
  };
  const txt = r => (typeof r === 'string' ? r : r.text || '').toLowerCase();
  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const results = {};
  let totalReturned = 0;

  for (const [cat, key] of Object.entries(KEYS)) {
    const arr = brain[key] || [];
    if (!arr.length) continue;

    const scored = arr
      .map(rule => {
        const text = txt(rule);
        if (!text) return null;
        let score = 0;
        let distinctHits = 0;
        for (const tok of tokens) {
          const wholeWord = new RegExp(`\\b${escapeRegex(tok)}\\b`, 'i');
          if (wholeWord.test(text))    { score += 3; distinctHits++; }
          else if (text.includes(tok)) { score += 1; distinctHits++; }
        }
        if (distinctHits >= 2) score += distinctHits * 2;
        return score > 0 ? { rule, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, perCategory)
      .map(x => x.rule);

    if (scored.length) {
      results[cat] = scored;
      totalReturned += scored.length;
      if (totalReturned >= totalCap) break;
    }
  }
  return results;
}

function formatRelevantRules(results) {
  const entries = Object.entries(results);
  if (!entries.length) return '';
  const txt = r => typeof r === 'string' ? r : r.text;
  const labels = {
    tone: 'TONE', avoid: 'AVOID', prefer: 'PREFER',
    product: 'PRODUCT', policy: 'POLICIES', example: 'EXAMPLES',
  };
  const total = entries.reduce((sum, [, arr]) => sum + arr.length, 0);
  const sections = entries.map(([cat, rules]) =>
    `${labels[cat]}:\n${rules.map(r => `  - ${txt(r)}`).join('\n')}`
  );
  return `RULES RELEVANT TO ADMIN'S CURRENT MESSAGE (${total} matched via keyword search across full brain):\n${sections.join('\n\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep consolidation — topic clustering + within-cluster merge + optional verify
// ─────────────────────────────────────────────────────────────────────────────

const CONSOLIDATE_HINTS = {
  tone:    'how agents communicate — voice, register, style',
  avoid:   'what agents must NEVER say or do',
  prefer:  'what agents must ALWAYS say or do',
  product: 'peptide product facts — dosing, storage, reconstitution, BAC water ratios, vial sizes, concentrations, ingredients, cycle lengths, stacks',
  policy:  'business policies — refunds, shipping, payment, returns, timelines, guarantees',
  example: 'gold-standard reply examples',
};

const TOPIC_VOCAB = {
  peptide: [
    'bpc-157','bpc157','bpc 157',
    'tb-500','tb500','tb 500',
    'semaglutide','sema ',
    'tirzepatide','tirz','tirze',
    'retatrutide','reta ',
    'cjc-1295','cjc1295','cjc ',
    'ipamorelin','ipa ',
    'hgh fragment','aod-9604','aod9604','aod ',
    'hgh','growth hormone',
    'nad+','nad ',
    'ghk-cu','ghk ','copper peptide',
    'melanotan','mt-2','mt2','pt-141','pt141','bremelanotide',
    'tesamorelin','tesa ',
    'mots-c','motsc',
    'epitalon','pinealon','dsip','selank','semax',
    'kisspeptin','gonadorelin','triptorelin',
    'wolverine','klow','glow stack',
  ],
  ops: [
    'reconstitut','bac water','bacteriostatic',
    'dose','dosing','mcg','iu',
    'injection','subcutaneous','intramuscular','inject',
    'storage','refrigerat','fridge','freezer','room temperature',
    'cycle','stack','protocol',
    'coa','certificate of analysis','purity',
    'vial','syringe','needle','insulin pin',
  ],
  policy: [
    'refund','return','cancel',
    'shipping','tracking','delivery','delivered','transit',
    'customs','duty','border','hold',
    'payment','card decline','chargeback',
    'stripe','helcim','interac','crypto','zelle',
    'lost','missing','late','delay',
    'discount','coupon','promo','first time customer',
    'guarantee','warranty','satisfaction',
    'french','francais','quebec',
  ],
  meta: [
    'apology','sorry','compensation','escalate',
    'greeting','sign-off','signature','closing',
  ],
};

function primaryTopic(text) {
  const lower = (text || '').toLowerCase();
  for (const bucket of ['peptide','ops','policy','meta']) {
    for (const term of TOPIC_VOCAB[bucket]) {
      if (lower.includes(term)) return `${bucket}:${term.trim()}`;
    }
  }
  return 'general';
}

function clusterRulesByTopic(rules) {
  const txt = r => (typeof r === 'string' ? r : r.text);
  const buckets = new Map();
  for (const r of rules) {
    const key = primaryTopic(txt(r));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }
  return [...buckets.entries()]
    .map(([topic, members]) => ({ topic, members }))
    .sort((a, b) => b.members.length - a.members.length);
}

function areSimilar(a, b) {
  const sig = s => new Set(s.toLowerCase().split(/[^a-z0-9-]+/).filter(w => w.length >= 4));
  const A = sig(a), B = sig(b);
  if (!A.size || !B.size) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) >= 0.5;
}

async function consolidateCategoryDeep(category, rules, apiKey, { verify = false } = {}) {
  const txt = r => (typeof r === 'string' ? r : r.text);
  const clusters = clusterRulesByTopic(rules);
  console.log(`[AI Training] ${category}: ${rules.length} rules → ${clusters.length} topic clusters`);

  const finalRules = [];
  const lostInfo = [];

  for (const { topic, members } of clusters) {
    if (members.length === 1) {
      finalRules.push(txt(members[0]));
      continue;
    }
    if (members.length === 2) {
      if (areSimilar(txt(members[0]), txt(members[1]))) {
        const merged = await consolidateOneCluster(category, topic, members.map(txt), apiKey);
        finalRules.push(...(merged && merged.length < 2 ? merged : members.map(txt)));
      } else {
        finalRules.push(...members.map(txt));
      }
      continue;
    }

    let working = members.map(txt);
    const CLUSTER_CHUNK = 30;

    if (working.length <= CLUSTER_CHUNK) {
      const out = await consolidateOneCluster(category, topic, working, apiKey);
      if (out && out.length && out.length < working.length) working = out;
    } else {
      const consolidated = [];
      for (let i = 0; i < working.length; i += CLUSTER_CHUNK) {
        const sub = working.slice(i, i + CLUSTER_CHUNK);
        const out = await consolidateOneCluster(category, topic, sub, apiKey);
        consolidated.push(...(out && out.length < sub.length ? out : sub));
        await new Promise(r => setTimeout(r, 350));
      }
      if (consolidated.length > CLUSTER_CHUNK) {
        const cap = Math.floor(CLUSTER_CHUNK * 1.5);
        const merged = await consolidateOneCluster(category, topic, consolidated.slice(0, cap), apiKey);
        working = merged && merged.length ? merged.concat(consolidated.slice(cap)) : consolidated;
      } else {
        working = consolidated;
      }
    }

    if (verify && members.length >= 3) {
      const dropped = await findDroppedInfo(category, topic, members.map(txt), working, apiKey);
      if (dropped && dropped.length) {
        console.log(`[AI Training] ${category}/${topic}: ${dropped.length} dropped detail(s) re-added`);
        working.push(...dropped);
        lostInfo.push({ topic, count: dropped.length });
      }
    }

    finalRules.push(...working);
  }

  return { rules: finalRules, clusters: clusters.length, lostInfo };
}

async function consolidateOneCluster(category, topic, rules, apiKey) {
  const systemPrompt = `You are consolidating customer-support training rules for a peptide e-commerce operation (400+ Shopify stores, Canada + US).

Category: ${category} — ${CONSOLIDATE_HINTS[category] || ''}
Cluster topic: ${topic}

All rules below are already pre-grouped by topic — they relate to the same peptide, the same policy, or the same operation. Many are duplicates, near-duplicates, or fragments of the same idea worded differently. Produce a tight consolidated set.

HARD REQUIREMENTS:
1. PRESERVE EVERY NUMERIC DETAIL — dosages (mcg, mg, iu), ratios (e.g. 2ml BAC water per 5mg vial), prices, vial sizes, day counts, temperatures, percentages, cycle lengths. If three input rules each contain a different dose for the same use case, the consolidated rule must list all three with their use case.
2. PRESERVE EVERY NAMED ENTITY — peptide names, brand names, processor names (Stripe/Helcim/Interac), currency names, product SKUs.
3. MERGE duplicates and near-duplicates into ONE self-contained rule containing the union of their information.
4. CONFLICTS: if two rules give incompatible facts (e.g. different BAC water ratios for the same peptide), KEEP BOTH as separate output rules and prefix the secondary with "ALT: " so admin can review. Never silently pick one.
5. DO NOT invent or extrapolate. If a fact wasn't in any input rule, it doesn't go in any output rule.
6. Output count MUST be strictly lower than input count. If genuinely nothing can be merged, return all inputs unchanged.
7. Each output rule must be plain text, agent-readable, self-contained. No numbering, no category labels, no "MASTER RULE:" prefixes.
8. Each output rule under 600 chars. If a merge would exceed that, split into two related rules instead.

RESPONSE FORMAT — valid JSON only, no markdown fences:
{
  "rules": ["rule 1", "rule 2"],
  "merged_from": <int — how many input rules were absorbed>,
  "conflicts_kept": <int — how many ALT-prefixed conflict rules>
}`;

  const userPrompt = `Consolidate these ${rules.length} ${category} rules (topic: ${topic}):\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const response = await callAnthropicAPI(requestBody, apiKey);
    const raw = response.content?.[0]?.text || '{}';
    const parsed = parseAIResponse(raw);
    if (!parsed || !Array.isArray(parsed.rules)) return null;

    const cleaned = parsed.rules
      .map(r => (typeof r === 'string' ? r.trim() : r?.text?.trim()))
      .filter(Boolean);
    console.log(`[AI Training] cluster ${category}/${topic}: ${rules.length} → ${cleaned.length} (merged ${parsed.merged_from ?? '?'}, alt ${parsed.conflicts_kept ?? 0})`);
    return cleaned;
  } catch (err) {
    console.error(`[AI Training] cluster ${category}/${topic} error:`, err.message);
    return null;
  }
}

async function findDroppedInfo(category, topic, originals, consolidated, apiKey) {
  const systemPrompt = `You audit rule consolidation for information loss.

Below are ORIGINAL rules (before consolidation) and CONSOLIDATED rules (after). Find every concrete detail present in originals but missing from consolidated.

Concrete detail = specific number, ratio, peptide name, brand name, price, vial size, temperature, day count, dose, route of administration, currency, or named exception.

Tone preferences, generic phrasing differences, and stylistic variation DO NOT count as lost information. Only flag concrete facts that disappeared.

For each lost detail, write ONE recovery rule capturing it. If nothing material is lost, return an empty array.

RESPONSE FORMAT — valid JSON only, no markdown fences:
{
  "lost": [
    { "detail": "what specifically was missing", "rule": "self-contained rule restoring this fact" }
  ]
}`;

  const userPrompt = `Category: ${category} | Topic: ${topic}

ORIGINAL (${originals.length}):
${originals.map((r, i) => `${i + 1}. ${r}`).join('\n')}

CONSOLIDATED (${consolidated.length}):
${consolidated.map((r, i) => `${i + 1}. ${r}`).join('\n')}

What concrete details from ORIGINAL are missing in CONSOLIDATED?`;

  try {
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const response = await callAnthropicAPI(requestBody, apiKey);
    const raw = response.content?.[0]?.text || '{}';
    const parsed = parseAIResponse(raw);
    if (!parsed || !Array.isArray(parsed.lost)) return [];

    return parsed.lost.map(item => item.rule).filter(Boolean);
  } catch (err) {
    console.error(`[AI Training] findDroppedInfo ${category}/${topic} error:`, err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// callAnthropicAPI — retries on 429/500/502/503/529 and transient network errors
// ─────────────────────────────────────────────────────────────────────────────
async function callAnthropicAPI(requestBody, apiKey) {
  const RETRYABLE_STATUS = [429, 500, 502, 503, 529];
  const MAX_ATTEMPTS = 4;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
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

      if (!res.ok) {
        if (RETRYABLE_STATUS.includes(res.status) && attempt < MAX_ATTEMPTS - 1) {
          const wait = 1500 * Math.pow(2, attempt);
          console.warn(`[AI Training] Anthropic ${res.status} — retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
      }

      return JSON.parse(text);

    } catch (err) {
      const retryable = err.name === 'TimeoutError' ||
        ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err.cause?.code);

      if (retryable && attempt < MAX_ATTEMPTS - 1) {
        const wait = 1500 * Math.pow(2, attempt);
        console.warn(`[AI Training] ${err.message} — retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}

module.exports = router;