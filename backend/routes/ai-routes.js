const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../auth');
const { getBrainContext, getBrainSettings, refreshBrainCache } = require('../brain-context');

const {
  humanizeText,
  callAnthropicAPIWithRetry,
  callAIForSuggestions,
  extractAdminStyle,
  buildAdminStyleBlock,
  buildSystemPrompt,
  buildUserPrompt,
  detectTrustQuestion,
  buildEnhancedAnalysisBlock,
  buildCustomerContext,
  buildPolicyBlock,
  analyzeConversationState,
  validateSuggestions,
  generateSmartFallbackSuggestions,
} = require('../lib/ai-suggestions');

// Tunable models in one place.
const SUGGEST_MODEL  = 'claude-haiku-4-5-20251001'; // fast path — short tone-matched replies
const DETAILED_MODEL = 'claude-sonnet-4-6';         // essay mode — needs the bigger model
const IMAGE_MODEL    = 'claude-sonnet-4-6';         // vision extraction quality matters

// Cap brain context so the primary (DeepSeek) and fallback (Claude) both stay
// under their timeouts. 17.7K-char brains were making DeepSeek time out at 12s.
// NOTE: this is a blunt slice — for a clean trim, reduce caps in brain-context.js.
const MAX_BRAIN_CHARS = 6000;

module.exports = function createAiRoutes({ getCachedStore }) {
  if (typeof getCachedStore !== 'function') {
    throw new Error('createAiRoutes requires a getCachedStore function');
  }

  const router = express.Router();

  const detailedFromFallback = (fallback) => ([
    { label: 'Empathetic',     text: fallback[0] || 'Unable to generate.' },
    { label: 'Thorough',       text: fallback[1] || 'Unable to generate.' },
    { label: 'Above & Beyond', text: fallback[2] || 'Unable to generate.' },
  ]);

  // ============ IMAGE ANALYSIS ============

  router.post('/analyze-image', authenticateToken, async (req, res) => {
    try {
      const { image, conversationId, storeIdentifier } = req.body;
      if (!image?.base64 || !image?.mimeType) return res.status(400).json({ error: 'image.base64 and image.mimeType are required' });
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED_TYPES.includes(image.mimeType)) return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' });
      const approxBytes = (image.base64.length * 3) / 4;
      if (approxBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image exceeds 5 MB limit.' });
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' });
      console.log(`🖼️  [ImageAnalysis] conv=${conversationId} type=${image.mimeType} approxKB=${Math.round(approxBytes / 1024)}`);
      let storeContext = '';
      if (storeIdentifier) {
        try { const store = await getCachedStore(storeIdentifier); if (store?.brand_name) storeContext = ` for ${store.brand_name}`; }
        catch (_) {}
      }
      const requestBody = JSON.stringify({ model: IMAGE_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
        { type: 'text', text: `You are a customer support assistant analyzing a screenshot uploaded by a support agent${storeContext}. Extract and report EVERYTHING visible in this image so the agent can write a precise, accurate reply to the customer.\n\nRead the ENTIRE screenshot carefully and extract:\n\n1. SCREEN TYPE — What kind of screen is this? (order confirmation, tracking page, error message, product page, payment screen, account page, chat/email, invoice, etc.)\n\n2. ALL VISIBLE TEXT — Extract every piece of text you can read: headings, labels, values, statuses, messages, error text, button labels, dates, times, prices, quantities, addresses, names, email addresses, phone numbers, reference numbers, order IDs, tracking numbers, product names, SKUs, descriptions — everything.\n\n3. KEY DATA POINTS — Specifically call out:\n   - Order/reference numbers (exact format, e.g. #1001, ORD-12345)\n   - Order status (pending, fulfilled, shipped, cancelled, refunded, etc.)\n   - Payment status and amounts (exact dollar figures)\n   - Tracking numbers and carrier names\n   - Shipping/delivery dates or estimated dates\n   - Product names, quantities, sizes, variants\n   - Customer name and email if visible\n   - Any error messages or warning text (copy exactly)\n   - Any action items, buttons, or options shown\n\n4. WHAT ISSUE THIS RELATES TO — Based on what you see, what is the customer's likely concern or question?\n\nWrite your response as a clear, structured report. Include every specific value — exact numbers, exact text, exact statuses. Do not summarize or paraphrase data — reproduce it exactly as shown. Plain text only, no markdown.` }
      ]}]});
      const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY);
      const analysis = data.content?.[0]?.text || '';
      console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
      return res.json({ analysis });
    } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
  });

  // ============ AI SUGGESTIONS — SINGLE ROUTE ============

  router.post('/suggestions', authenticateToken, async (req, res) => {
    try {
      const { clientMessage, chatHistory, agentStyleSamples = [], recentContext, customerName, customerEmail, storeName, analysis, adminNote, messageEdited, detailedAnswerMode, adminImage, imageAnalysis } = req.body;
      let brainSettings = req.body.brainSettings || {};
      if (!clientMessage) return res.status(400).json({ error: 'clientMessage is required' });
      const contextQuality = recentContext?.contextQuality || 'minimal';
      const messageRichness = recentContext?.messageRichness || 'brief';
      console.log(`✦ [AI] context: ${contextQuality}, richness: ${messageRichness}, agentSamples: ${agentStyleSamples.length}, detailedMode: ${!!detailedAnswerMode}, imageAnalysis: ${!!imageAnalysis}`);
      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
        if (detailedAnswerMode) return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback' });
        return res.json({ suggestions: fallback, fallback: true, source: 'fallback' });
      }
      const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
      const isTrustQuestion = detectTrustQuestion(clientMessage);
      if (isTrustQuestion) console.log('✦ [AI] Trust/legitimacy question detected — proof-first mode');
      const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
      const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
      const policyBlock = buildPolicyBlock();
      const adminStyle = extractAdminStyle(chatHistory, agentStyleSamples);
      const adminStyleBlock = buildAdminStyleBlock(adminStyle);
      if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}`);
      else console.log(`✦ [AI] No style yet — not enough agent replies`);

      // Augment retrieval for pickup/delivery/location intent (see original note).
      let brainSearchTerms = clientMessage;
      if (/pick.?up|collect|in.?person|in.?store|walk.?in|delivery|deliver|shipping|\bship\b|postage|courier|mail|when.*(arrive|get here|receive|come)|how long|near(by)?|close to|local\b/i.test(clientMessage)) {
        brainSearchTerms = `${clientMessage} shipping delivery handling time dispatch pickup collection in-person order fulfillment how long to arrive shipping policy`;
        console.log('✦ [AI] Shipping/pickup/location intent — augmenting brain retrieval query');
      }

      // ── Run all three brain/DB lookups in parallel instead of sequentially. ──
      let brainContext = '';
      let responseExamples = [];
      const needSettings = !brainSettings.length && !brainSettings.tone && !brainSettings.empathy;

      console.time('✦ [AI] brainDB');
      const [brainRes, settingsRes, exRes] = await Promise.allSettled([
        getBrainContext(db.pool, brainSearchTerms),
        needSettings ? getBrainSettings(db.pool) : Promise.resolve(null),
        db.pool.query(
          `SELECT brain_data -> 'responseExamples' AS examples
             FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
        ),
      ]);
      console.timeEnd('✦ [AI] brainDB');

      if (brainRes.status === 'fulfilled') brainContext = brainRes.value || '';
      else console.error('🧠 [Brain] Failed:', brainRes.reason?.message);

      if (settingsRes.status === 'fulfilled' && settingsRes.value) brainSettings = settingsRes.value;
      else if (settingsRes.status === 'rejected') console.error('🧠 [Brain] settings fetch failed:', settingsRes.reason?.message);

      if (exRes.status === 'fulfilled') responseExamples = Array.isArray(exRes.value.rows[0]?.examples) ? exRes.value.rows[0].examples : [];
      else console.error('🧠 [Brain] responseExamples fetch failed:', exRes.reason?.message);

      // Cap the brain so both providers stay under their timeouts.
      if (brainContext.length > MAX_BRAIN_CHARS) {
        const before = brainContext.length;
        brainContext = brainContext.slice(0, MAX_BRAIN_CHARS);
        console.log(`🧠 [Brain] truncated ${before}c → ${MAX_BRAIN_CHARS}c`);
      }

      console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}" — ${responseExamples.length} example(s)`);

      const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

      if (detailedAnswerMode) {
        const brainSystemSection = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES — READ FIRST. Override all other guidelines.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUse brain data as the ONLY source of truth for product info, protocols, dosing, and policies.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const trustSystemSection = isTrustQuestion ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTRUST / "AM I GETTING SCAMMED" QUESTION — OVERRIDES LENGTH BELOW\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe customer fears being scammed (payment is likely e-transfer/crypto, no chargeback). A long, enthusiastic essay reads as overselling, which is a red flag here. Keep ALL three replies short and calm (2 to 4 sentences), NOT 8 to 15. Acknowledge the worry once and name why it is fair (the payment isn't reversible), then point ONLY to verification the brain data provides (whatever proof it lists, quoted exactly) that they can check before paying. NEVER bare-assert legitimacy ("we're safe/legit", "nothing to worry about", "100% safe"), NEVER invent a confirmation timeline, NEVER fabricate proof, review counts, years, or ratings. If the brain lists no verifiable proof, be honest and offer to send them what you have rather than inventing it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const systemPrompt = `${trustSystemSection}${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}You are ghostwriting detailed replies for a human support agent. All three styles must sound like the SAME person.\n\nWrite like a real person typing in a support chat, not like an AI. Never use em dashes or double hyphens (--) anywhere, use commas or periods instead. No essay-style transitions like "furthermore" or "moreover". Short, natural sentences.\n\nNO fake time promises: state a shipping, handling, or delivery timeframe ONLY if it appears in the brain data above, quoted exactly. If the brain gave no timeframe, do not state one, point to tracking or commit to the action instead. Never say "same day", "next day", "overnight", or infer speed from the customer's location. Never invent tracking status, stock, or pickup options.\n\nWrite three distinct, highly detailed replies (8–15 sentences each) in flowing paragraphs. No bullet points. Use real values from the conversation and brain only.\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Deep emotional validation first, then full answer with warmth.\nThorough: Every product detail, step, policy, and expectation. Nothing unanswered.\nAbove & Beyond: Everything in Thorough plus extras — tips, related products, follow-up offer.\n\nReturn ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;
        const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Return only the JSON.`;
        const requestBody = JSON.stringify({ model: DETAILED_MODEL, max_tokens: 2000, temperature: 0.5, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
        console.time('✦ [AI] llmDetailed');
        const anthropicData = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
        console.timeEnd('✦ [AI] llmDetailed');
        const rawContent = anthropicData.content?.[0]?.text || '';
        console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
        let parsed;
        try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
        catch {
          const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
          return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback' });
        }
        const detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : [{ label: 'Empathetic', text: rawContent }, { label: 'Thorough', text: rawContent }, { label: 'Above & Beyond', text: rawContent }];
        detailedAnswers.forEach(a => { if (a?.text) a.text = humanizeText(a.text); });
        return res.json({ detailedAnswers, fallback: false, source: 'ai' });
      }

      const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext, brainSettings, adminStyleBlock, imageAnalysis, conversationState?.sentiment || analysis?.sentiment || 'neutral', responseExamples, isTrustQuestion);
      const userPrompt = buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext, imageAnalysis || '');
      const requestBody = JSON.stringify({ model: SUGGEST_MODEL, max_tokens: 700, temperature: 0.6, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
      console.log(`✦ [AI] Calling ${SUGGEST_MODEL} — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, examples: ${responseExamples.length}, image: ${!!imageAnalysis}`);
      console.time('✦ [AI] llmSuggest');
      const anthropicData = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
      console.timeEnd('✦ [AI] llmSuggest');
      const rawContent = anthropicData.content?.[0]?.text || '';
      console.log(`✦ [AI] Raw (first 300): ${rawContent.substring(0, 300)}`);

      let usedFallback = false;

      let parsed;
      try { parsed = JSON.parse(rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); }
      catch {
        console.error('✦ [AI] JSON parse failed. Raw:', rawContent.substring(0, 500));
        return res.json({ suggestions: generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote), fallback: true, source: 'fallback' });
      }

      let suggestions;
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 3);
      else if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
      else { suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote); usedFallback = true; }

      console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
      if (!usedFallback) {
        suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
        console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
        if (suggestions.length === 0) {
          console.log('✦ [AI] All suggestions filtered — using fallback');
          suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
          usedFallback = true;
        }
      }

      suggestions = suggestions.map(humanizeText);

      res.json({ suggestions, fallback: usedFallback, source: usedFallback ? 'fallback' : 'ai' });
    } catch (error) {
      console.error('✦ [AI] Endpoint error:', error.message, error.stack);
      const fallback = generateSmartFallbackSuggestions(req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || '');
      if (req.body?.detailedAnswerMode) {
        return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback' });
      }
      res.json({ suggestions: fallback, fallback: true, source: 'fallback' });
    }
  });

  // ============ BRAIN DEBUG / CACHE ============

  router.get('/brain-debug', authenticateToken, async (req, res) => {
    try {
      const result = await db.pool.query(`SELECT brain_data, updated_at FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`);
      if (!result.rows.length) return res.json({ status: 'empty', message: 'No brain data in database' });
      const brain = result.rows[0].brain_data; const updatedAt = result.rows[0].updated_at;
      const summary = {}; for (const [key, val] of Object.entries(brain || {})) summary[key] = Array.isArray(val) ? val.length : typeof val;
      const productSample = (brain?.productKnowledge || []).slice(0, 3).map(r => typeof r === 'string' ? r : r?.text);
      return res.json({ status: 'found', updatedAt, categorySummary: summary, productKnowledgeSample: productSample, totalCategories: Object.keys(brain || {}).length });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  router.post('/brain-cache/clear', authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      refreshBrainCache();
      return res.json({ ok: true, message: 'Brain cache cleared — next request will reload from DB' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  });

  return router;
};