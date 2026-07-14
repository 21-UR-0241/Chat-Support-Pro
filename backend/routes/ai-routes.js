

// const express = require('express');
// const db = require('../database');
// const { authenticateToken } = require('../auth');
// const { getBrainContext, getBrainSettings, refreshBrainCache } = require('../brain-context');

// const {
//   humanizeText,
//   callAnthropicAPIWithRetry,
//   callAIForSuggestions,
//   parseAIResponse,                    // ← ADDED: robust reasoning-then-JSON parser
//   extractAdminStyle,
//   buildAdminStyleBlock,
//   buildSystemPrompt,
//   buildUserPrompt,
//   detectTrustQuestion,
//   detectSafetyDosingQuestion,
//   buildEnhancedAnalysisBlock,
//   buildCustomerContext,
//   buildPolicyBlock,
//   analyzeConversationState,
//   validateSuggestions,
//   validateSafetyDosing,   
//   generateSmartFallbackSuggestions,
// } = require('../lib/ai-suggestions');

// // Tunable models in one place.
// const SUGGEST_MODEL  = 'claude-haiku-4-5-20251001'; // Claude fallback for fast path
// const DETAILED_MODEL = 'claude-sonnet-4-6';         // Claude fallback for essay mode
// const IMAGE_MODEL    = 'claude-sonnet-4-6';         // vision extraction quality matters
// const MAX_BRAIN_CHARS = 8000;
// const SUGGEST_MAX_TOKENS = 4000;
// const REFUND_COMPLAINT_RE = /refund|money back|reimburse|charge.?back|cancel(l|led|ling|lation)?|escalat|complaint|unacceptable|lawyer|attorney|sue|dispute|still waiting|no (tracking|update|response|communication)|missed|delay(ed|s)?/i;
// const SHIPPING_LOCATION_RE = /pick.?up|collect|in.?person|in.?store|walk.?in|delivery|deliver|shipping|\bship\b|postage|courier|mail|when.*(arrive|get here|receive|come)|how long|near(by)?|close to|local\b/i;
// const CRITICAL_POLICY_RE = /refund|unshipped|unfulfilled|not shipped|shipped\/|delivered|store credit|e-transfer|escalate|escalation|replacement|reship|return-to-sender|lost package|cancel/i;
// const JSON_HARDENING_SUFFIX = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOUTPUT FORMAT — ABSOLUTE, OVERRIDES EVERYTHING ABOVE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDo ALL of your thinking silently. Output NOTHING before the JSON — no analysis, no "we are asked to", no restating the customer's question, no reasoning, no preamble of any kind. Your ENTIRE response is the single JSON object and nothing else. The FIRST character you output must be { and the LAST character must be }. Start immediately with {.`;

// module.exports = function createAiRoutes({ getCachedStore }) {
//   if (typeof getCachedStore !== 'function') {
//     throw new Error('createAiRoutes requires a getCachedStore function');
//   }

//   const router = express.Router();

//   const detailedFromFallback = (fallback) => ([
//     { label: 'Empathetic',     text: fallback[0] || 'Unable to generate.' },
//     { label: 'Thorough',       text: fallback[1] || 'Unable to generate.' },
//     { label: 'Above & Beyond', text: fallback[2] || 'Unable to generate.' },
//   ]);

//   // ============ IMAGE ANALYSIS ============

//   router.post('/analyze-image', authenticateToken, async (req, res) => {
//     try {
//       const { image, conversationId, storeIdentifier } = req.body;
//       if (!image?.base64 || !image?.mimeType) return res.status(400).json({ error: 'image.base64 and image.mimeType are required' });
//       const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
//       if (!ALLOWED_TYPES.includes(image.mimeType)) return res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' });
//       const approxBytes = (image.base64.length * 3) / 4;
//       if (approxBytes > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image exceeds 5 MB limit.' });
//       const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//       if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured (missing ANTHROPIC_API_KEY)' });
//       console.log(`🖼️  [ImageAnalysis] conv=${conversationId} type=${image.mimeType} approxKB=${Math.round(approxBytes / 1024)}`);
//       let storeContext = '';
//       if (storeIdentifier) {
//         try { const store = await getCachedStore(storeIdentifier); if (store?.brand_name) storeContext = ` for ${store.brand_name}`; }
//         catch (_) {}
//       }
//       const requestBody = JSON.stringify({ model: IMAGE_MODEL, max_tokens: 1024, messages: [{ role: 'user', content: [
//         { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
//         { type: 'text', text: `You are a customer support assistant analyzing a screenshot uploaded by a support agent${storeContext}. Extract and report EVERYTHING visible in this image so the agent can write a precise, accurate reply to the customer.\n\nRead the ENTIRE screenshot carefully and extract:\n\n1. SCREEN TYPE — What kind of screen is this? (order confirmation, tracking page, error message, product page, payment screen, account page, chat/email, invoice, etc.)\n\n2. ALL VISIBLE TEXT — Extract every piece of text you can read: headings, labels, values, statuses, messages, error text, button labels, dates, times, prices, quantities, addresses, names, email addresses, phone numbers, reference numbers, order IDs, tracking numbers, product names, SKUs, descriptions — everything.\n\n3. KEY DATA POINTS — Specifically call out:\n   - Order/reference numbers (exact format, e.g. #1001, ORD-12345)\n   - Order status (pending, fulfilled, shipped, cancelled, refunded, etc.)\n   - Payment status and amounts (exact dollar figures)\n   - Tracking numbers and carrier names\n   - Shipping/delivery dates or estimated dates\n   - Product names, quantities, sizes, variants\n   - Customer name and email if visible\n   - Any error messages or warning text (copy exactly)\n   - Any action items, buttons, or options shown\n\n4. WHAT ISSUE THIS RELATES TO — Based on what you see, what is the customer's likely concern or question?\n\nWrite your response as a clear, structured report. Include every specific value — exact numbers, exact text, exact statuses. Do not summarize or paraphrase data — reproduce it exactly as shown. Plain text only, no markdown.` }
//       ]}]});
//       const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY, 1, 40000); 
//       const analysis = data.content?.[0]?.text || '';
//       console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
//       return res.json({ analysis });
//     } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
//   });

//   // ============ AI SUGGESTIONS — SINGLE ROUTE ============

//   router.post('/suggestions', authenticateToken, async (req, res) => {
//     try {
//       const { clientMessage, chatHistory, agentStyleSamples = [], recentContext, customerName, customerEmail, storeName, analysis, adminNote, messageEdited, detailedAnswerMode, adminImage, imageAnalysis } = req.body;
//       let brainSettings = req.body.brainSettings || {};
//       if (!clientMessage) return res.status(400).json({ error: 'clientMessage is required' });
//       const contextQuality = recentContext?.contextQuality || 'minimal';
//       const messageRichness = recentContext?.messageRichness || 'brief';
//       console.log(`✦ [AI] context: ${contextQuality}, richness: ${messageRichness}, agentSamples: ${agentStyleSamples.length}, detailedMode: ${!!detailedAnswerMode}, imageAnalysis: ${!!imageAnalysis}`);
//       const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
//       if (!ANTHROPIC_API_KEY) {
//         const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
//         if (detailedAnswerMode) return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider: 'none' });
//         return res.json({ suggestions: fallback, fallback: true, source: 'fallback', provider: 'none' });
//       }
//       const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
//       const isTrustQuestion = detectTrustQuestion(clientMessage);
//       if (isTrustQuestion) console.log('✦ [AI] Trust/legitimacy question detected — proof-first mode');
//       const isSafetyDosing = detectSafetyDosingQuestion(clientMessage);
//       if (isSafetyDosing) console.log('✦ [AI] Safety/dosing question detected — honesty+provider gate on');
//       const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
//       const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
//       const policyBlock = buildPolicyBlock();
//       const adminStyle = extractAdminStyle(chatHistory, agentStyleSamples);
//       const adminStyleBlock = buildAdminStyleBlock(adminStyle);
//       if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}`);
//       else console.log(`✦ [AI] No style yet — not enough agent replies`);

//       let brainSearchTerms = clientMessage;
//       const isRefundOrComplaint = REFUND_COMPLAINT_RE.test(clientMessage);
//       if (isRefundOrComplaint) {
//         brainSearchTerms = `${clientMessage} refund policy unshipped unfulfilled not shipped store credit e-transfer escalation cancellation replacement reship missing items delay compensation`;
//         console.log('✦ [AI] Refund/complaint intent — augmenting brain retrieval toward refund policy');
//       } else if (SHIPPING_LOCATION_RE.test(clientMessage)) {
//         brainSearchTerms = `${clientMessage} shipping delivery handling time dispatch pickup collection in-person order fulfillment how long to arrive shipping policy`;
//         console.log('✦ [AI] Shipping/pickup/location intent — augmenting brain retrieval query');
//       }
//       let brainContext = '';
//       let responseExamples = [];
//       const needSettings = !brainSettings.length && !brainSettings.tone && !brainSettings.empathy;

//       console.time('✦ [AI] brainDB');
//       const [brainRes, settingsRes, exRes] = await Promise.allSettled([
//         getBrainContext(db.pool, brainSearchTerms),
//         needSettings ? getBrainSettings(db.pool) : Promise.resolve(null),
//         db.pool.query(
//           `SELECT brain_data -> 'responseExamples' AS examples
//              FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
//         ),
//       ]);
//       console.timeEnd('✦ [AI] brainDB');

//       if (brainRes.status === 'fulfilled') brainContext = brainRes.value || '';
//       else console.error('🧠 [Brain] Failed:', brainRes.reason?.message);

//       if (settingsRes.status === 'fulfilled' && settingsRes.value) brainSettings = settingsRes.value;
//       else if (settingsRes.status === 'rejected') console.error('🧠 [Brain] settings fetch failed:', settingsRes.reason?.message);

//       if (exRes.status === 'fulfilled') responseExamples = Array.isArray(exRes.value.rows[0]?.examples) ? exRes.value.rows[0].examples : [];
//       else console.error('🧠 [Brain] responseExamples fetch failed:', exRes.reason?.message);
//       if (brainContext.length > MAX_BRAIN_CHARS) {
//         const before = brainContext.length;

//         if (isRefundOrComplaint) {
//           const lines = brainContext.split('\n');
//           const critical = [];
//           const rest = [];
//           for (const line of lines) (CRITICAL_POLICY_RE.test(line) ? critical : rest).push(line);
//           if (critical.length) {
//             brainContext = [...critical, ...rest].join('\n');
//             console.log(`🧠 [Brain] refund/complaint — hoisted ${critical.length} critical policy line(s) before truncation`);
//           }
//         }

//         brainContext = brainContext.slice(0, MAX_BRAIN_CHARS);
//         console.log(`🧠 [Brain] truncated ${before}c → ${MAX_BRAIN_CHARS}c`);
//       }

//       console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}" — ${responseExamples.length} example(s)`);

//       const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

//       if (detailedAnswerMode) {
//         // const brainSystemSection = brainContext?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nBRAIN RULES — READ FIRST. Override all other guidelines.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nUse brain data as the ONLY source of truth for product info, protocols, dosing, and policies.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const brainSystemSection = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         BRAIN RULES — READ FIRST.
//         Mandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice instructions below, say these facts the way a real person talks, not like a spec sheet.
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         ${brainContext}
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         Use brain data as the ONLY source of truth for product info, protocols, dosing, and policies. Every number, dose, product name, and policy term must come verbatim from the matching brain rule, never invent or round, but restate them in plain conversational language, don't copy brain-rule sentences word-for-word.
//         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//         ` : '';
//         const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const trustSystemSection = isTrustQuestion ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTRUST / "AM I GETTING SCAMMED" QUESTION — OVERRIDES LENGTH BELOW\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe customer fears being scammed (payment is likely e-transfer/crypto, no chargeback). A long, enthusiastic essay reads as overselling, which is a red flag here. Keep ALL three replies short and calm (2 to 4 sentences), NOT 8 to 15. Acknowledge the worry once and name why it is fair (the payment isn't reversible), then point ONLY to verification the brain data provides (whatever proof it lists, quoted exactly) that they can check before paying. NEVER bare-assert legitimacy ("we're safe/legit", "nothing to worry about", "100% safe"), NEVER invent a confirmation timeline, NEVER fabricate proof, review counts, years, or ratings. If the brain lists no verifiable proof, be honest and offer to send them what you have rather than inventing it.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const safetySystemSection = isSafetyDosing ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDOSING / SAFETY QUESTION — HONESTY AND SAFETY GATES OVERRIDE EVERYTHING\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nState a dose, mg amount, frequency, or titration step ONLY if it appears in the brain data above for THIS product, quoted exactly. Confirm which product first if it isn't pinned down. Never carry a number over from your own knowledge, from the chat history, or infer it. Never say a dose "is safe" or "you'll be fine" and never promise an outcome ("you'll still see progress", "you'll lose weight") unless the brain states it. Never give titration advice as your own judgement, relay the brain's protocol exactly or don't state one. Whenever the customer raises getting sick, side effects, a health condition, pregnancy, other medications, or "is this safe for me", point them to their healthcare provider before changing dose, one line, fused in.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
//         const systemPrompt = `${trustSystemSection}${safetySystemSection}${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}You are ghostwriting detailed replies for a human support agent. All three styles must sound like the SAME person.\n\nWrite like a real person typing in a support chat, not like an AI. Never use em dashes or double hyphens (--) anywhere, use commas or periods instead. No essay-style transitions like "furthermore" or "moreover". Short, natural sentences.\n\nNO fake time promises: state a shipping, handling, or delivery timeframe ONLY if it appears in the brain data above, quoted exactly. If the brain gave no timeframe, do not state one, point to tracking or commit to the action instead. Never say "same day", "next day", "overnight", or infer speed from the customer's location. Never invent tracking status, stock, or pickup options.\n\nWrite three distinct, highly detailed replies (8–15 sentences each) in flowing paragraphs. No bullet points. Use real values from the conversation and brain only.\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Deep emotional validation first, then full answer with warmth.\nThorough: Every product detail, step, policy, and expectation. Nothing unanswered.\nAbove & Beyond: Everything in Thorough plus extras — tips, related products, follow-up offer.\n\nThink through your answer first if you need to, but your response MUST END with the JSON object and nothing after it. The JSON is the last thing in your output. Return ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;
//         const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Your response must END with the JSON, nothing after it.`;
//         const requestBody = JSON.stringify({ model: DETAILED_MODEL, max_tokens: 3000, temperature: 0.5, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
//         console.time('✦ [AI] llmDetailed');
//         // callAIForSuggestions now returns { data, provider } — see lib/ai-suggestions.js.
//         const { data: anthropicData, provider } = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
//         console.timeEnd('✦ [AI] llmDetailed');
//         const rawContent = anthropicData.content?.[0]?.text || '';
//         console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
//         const parsed = parseAIResponse(rawContent, 'detailedAnswers');
//         if (!parsed) {
//           const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
//           return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider });
//         }
//         const detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : null;
//         if (!detailedAnswers) {
//           console.warn('✦ [AI] Detailed parsed but detailedAnswers not an array — serving fallback');
//           const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
//           return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider });
//         }
//         detailedAnswers.forEach(a => { if (a?.text) a.text = humanizeText(a.text); });
//         return res.json({ detailedAnswers, fallback: false, source: 'ai', provider });
//       }
//       const systemPrompt = buildSystemPrompt(storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness, brainContext, brainSettings, adminStyleBlock, imageAnalysis, conversationState?.sentiment || analysis?.sentiment || 'neutral', responseExamples, isTrustQuestion, isSafetyDosing) + JSON_HARDENING_SUFFIX;
//       const userPrompt = buildUserPrompt(chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext, brainContext, imageAnalysis || '');
//       const requestBody = JSON.stringify({ model: SUGGEST_MODEL, max_tokens: SUGGEST_MAX_TOKENS, temperature: 0.6, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });
//       console.log(`✦ [AI] Calling suggestions (DeepSeek primary / ${SUGGEST_MODEL} fallback) — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, examples: ${responseExamples.length}, image: ${!!imageAnalysis}, maxTokens: ${SUGGEST_MAX_TOKENS}`);
//       console.time('✦ [AI] llmSuggest');
//       const { data: anthropicData, provider } = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
//       console.timeEnd('✦ [AI] llmSuggest');
//       const rawContent = anthropicData.content?.[0]?.text || '';
//       console.log(`✦ [AI] Served by: ${provider} — Raw (first 300): ${rawContent.substring(0, 300)}`);

//       let usedFallback = false;

//       const parsed = parseAIResponse(rawContent, 'suggestions');
//       if (!parsed) {
//         console.error(`✦ [AI] JSON parse failed (provider=${provider}). Raw:`, rawContent.substring(0, 500));
//         return res.json({ suggestions: generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote), fallback: true, source: 'fallback', provider });
//       }

// let suggestions;
//       if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 3);
//       else if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
//       else { suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote); usedFallback = true; }

//       console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
//       if (!usedFallback) {
//         suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
//         console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
//         if (suggestions.length === 0) {
//           console.log('✦ [AI] All suggestions filtered — using fallback');
//           suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
//           usedFallback = true;
//         }
//       }

//       suggestions = suggestions.map(humanizeText);

//       let safetyReview = [];
//       if (isSafetyDosing && !usedFallback) {
//         console.log('✦ [AI] Running safety enforcement (flag mode)...');
//         const result = validateSafetyDosing(suggestions);
//         suggestions  = result.suggestions;   // pull the array out of the object
//         safetyReview = result.needsReview;
//       }

//       res.json({ suggestions, fallback: usedFallback, source: usedFallback ? 'fallback' : 'ai', provider, needsReview: safetyReview });


//     } catch (error) {
//       console.error('✦ [AI] Endpoint error:', error.message, error.stack);
//       // Nothing completed — no provider produced this. provider: 'none'.
//       const fallback = generateSmartFallbackSuggestions(req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || '');
//       if (req.body?.detailedAnswerMode) {
//         return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider: 'none' });
//       }
//       res.json({ suggestions: fallback, fallback: true, source: 'fallback', provider: 'none' });
//     }
//   });

//   // ============ BRAIN DEBUG / CACHE ============

//   router.get('/brain-debug', authenticateToken, async (req, res) => {
//     try {
//       const result = await db.pool.query(`SELECT brain_data, updated_at FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`);
//       if (!result.rows.length) return res.json({ status: 'empty', message: 'No brain data in database' });
//       const brain = result.rows[0].brain_data; const updatedAt = result.rows[0].updated_at;
//       const summary = {}; for (const [key, val] of Object.entries(brain || {})) summary[key] = Array.isArray(val) ? val.length : typeof val;
//       const productSample = (brain?.productKnowledge || []).slice(0, 3).map(r => typeof r === 'string' ? r : r?.text);
//       return res.json({ status: 'found', updatedAt, categorySummary: summary, productKnowledgeSample: productSample, totalCategories: Object.keys(brain || {}).length });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   router.post('/brain-cache/clear', authenticateToken, async (req, res) => {
//     try {
//       if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
//       refreshBrainCache();
//       return res.json({ ok: true, message: 'Brain cache cleared — next request will reload from DB' });
//     } catch (err) { return res.status(500).json({ error: err.message }); }
//   });

//   return router;
// };





const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../auth');
const { getBrainContext, getBrainSettings, refreshBrainCache } = require('../brain-context');

const {
  humanizeText,
  callAnthropicAPIWithRetry,
  callAIForSuggestions,
  parseAIResponse,
  extractAdminStyle,
  buildAdminStyleBlock,
  buildSystemPrompt,
  buildUserPrompt,
  buildBrainQuery,
  detectTrustQuestion,
  detectSafetyDosingQuestion,
  detectStall,
  STALL_RETRY_INSTRUCTION,
  buildEnhancedAnalysisBlock,
  buildCustomerContext,
  buildPolicyBlock,
  analyzeConversationState,
  validateSuggestions,
  validateSafetyDosing,
  generateSmartFallbackSuggestions,
} = require('../lib/ai-suggestions');

// PRODUCT-SCOPED dosing guards. A blob-wide "does this text contain a mL?" check is
// always true (20+ products in one 8000-char context) — which is how HGH Fragment's
// "add 1mL BAC water to 5mg vial" got re-badged as Retatrutide's ratio.
const {
  brainDosingCoverage,
  brainHasDosingAnswer,
  detectNumberContamination,
} = require('../lib/brain-guards');

// Canonical, code-owned dosing facts. Prepended to the retrieved brain context so they
// can never be truncated away, deleted by the dupe scanner, or overwritten by
// AITraining.jsx's whole-object autosave.
const { injectProductFacts } = require('../lib/product-facts');

// COMMITMENT guards. The dosing guards stop the model inventing a NUMBER. Nothing
// stopped it inventing a PROMISE — it offered a customer "a free Snap-8 vial", a
// product that appears nowhere in the catalog, in violation of four separate brain
// rules about compensation. Same failure shape, different surface.
const { validateCommitments } = require('../lib/commitment-guards');

// ── BOOT ASSERTION ──────────────────────────────────────────────────────────
// A dosing turn once logged `productAnswer: false` and shipped "1mL BAC water, 5 units"
// anyway. No contamination log, no coverage log — the guards were simply not in the
// request path, and nothing said so.
//
// A safety check that can be absent without anyone noticing is not a safety check.
// If the wiring is wrong, refuse to start. A dead service is recoverable; a wrong dose
// in a syringe is not.
(function assertGuardsWired() {
  const facts       = require('../lib/product-facts');
  const guards      = require('../lib/brain-guards');
  const commitments = require('../lib/commitment-guards');

  const required = [
    [facts,       'lib/product-facts.js',     ['injectProductFacts', 'canonicalProductName', 'hasCanonicalDosing', 'allowedNumbersFor']],
    [guards,      'lib/brain-guards.js',      ['brainDosingCoverage', 'brainHasDosingAnswer', 'detectNumberContamination']],
    [commitments, 'lib/commitment-guards.js', ['validateCommitments', 'detectInventedProducts', 'detectUnauthorisedFreeOffer']],
  ];
  for (const [mod, file, fns] of required) {
    for (const fn of fns) {
      if (typeof mod[fn] !== 'function') {
        throw new Error(`[BOOT] Guard missing: ${file} does not export ${fn}(). Refusing to start.`);
      }
    }
  }

  // Self-test the exact failures that reached customers.
  const anchor = facts.canonicalProductName('reta');
  if (anchor !== 'Retatrutide') {
    throw new Error(`[BOOT] Alias canonicalisation broken: 'reta' resolved to '${anchor}', expected 'Retatrutide'. Every product-scoped regex would silently match nothing.`);
  }

  const dose = guards.detectNumberContamination(
    ['Reconstitute that vial with 2.5mL BAC water for 4mg/mL.'],
    '', 'Retatrutide'
  );
  if (dose.contaminated.length !== 1) {
    throw new Error('[BOOT] Contamination guard failed to block an unauthorised dose. Refusing to start.');
  }

  const promise = commitments.validateCommitments(
    ["I'll add a free Snap-8 vial to your next order as a make-good."], ''
  );
  if (promise.blocked.length !== 1) {
    throw new Error('[BOOT] Commitment guard failed to block an invented free product. Refusing to start.');
  }

  console.log('✅ [BOOT] Safety guards wired and self-tested (reta → Retatrutide; unauthorised dose blocked; invented free product blocked).');
})();

// Tunable models in one place.
const SUGGEST_MODEL  = 'claude-haiku-4-5-20251001';
const DETAILED_MODEL = 'claude-sonnet-4-6';
const IMAGE_MODEL    = 'claude-sonnet-4-6';
const MAX_BRAIN_CHARS = 12000;
const SUGGEST_MAX_TOKENS = 4000;

const REFUND_COMPLAINT_RE = /refund|money back|reimburse|charge.?back|cancel(l|led|ling|lation)?|escalat|complaint|unacceptable|lawyer|attorney|sue|dispute|still waiting|no (tracking|update|response|communication)|missed|delay(ed|s)?/i;
const SHIPPING_LOCATION_RE = /pick.?up|collect|in.?person|in.?store|walk.?in|delivery|deliver|shipping|\bship\b|postage|courier|mail|when.*(arrive|get here|receive|come)|how long|near(by)?|close to|local\b/i;
const CRITICAL_POLICY_RE = /refund|unshipped|unfulfilled|not shipped|shipped\/|delivered|store credit|e-transfer|escalate|escalation|replacement|reship|return-to-sender|lost package|cancel|mystery vial|goodwill|compensation|free product/i;
const CRITICAL_DOSING_RE = /reconstitut|bacteriostatic|bac water|\bmg\s*\/\s*ml\b|\bunits?\b|starting dose|start dose|titrat|escalation|\bmL\b/i;

const JSON_HARDENING_SUFFIX = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nOUTPUT FORMAT — ABSOLUTE, OVERRIDES EVERYTHING ABOVE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDo ALL of your thinking silently. Output NOTHING before the JSON — no analysis, no "we are asked to", no restating the customer's question, no reasoning, no preamble of any kind. Your ENTIRE response is the single JSON object and nothing else. The FIRST character you output must be { and the LAST character must be }. Start immediately with {.`;

// Injected on any turn where compensation is plausibly on the table. The brain permits
// exactly ONE compensation product, and the model kept inventing others.
const COMPENSATION_BLOCK = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPENSATION — YOU MAY NOT INVENT A PROMISE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNever name a specific free product. The ONLY compensation you may offer is a free MYSTERY vial, chosen from current stock, and the customer does not get to pick it. "I'll add a free [product name]" is banned outright, and naming a product we do not sell is worse still.\n\nNever offer a discount, a shipping-cost refund, an expedited upgrade, or a cancellation on your own authority. Orders cannot be cancelled once placed. Anything beyond the brain's named remedies needs admin approval, and a promise you cannot keep to an already-angry customer costs more than the delay did.\n\nOffer only what the BRAIN DATA explicitly authorises, in the words it authorises.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

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
      const data = await callAnthropicAPIWithRetry(requestBody, ANTHROPIC_API_KEY, 1, 40000);
      const analysis = data.content?.[0]?.text || '';
      console.log(`🖼️  [ImageAnalysis] Done — ${analysis.length} chars`);
      return res.json({ analysis });
    } catch (err) { console.error('🖼️  [ImageAnalysis] Error:', err.message); return res.status(500).json({ error: 'Image analysis failed', message: err.message }); }
  });

  // ============ AI SUGGESTIONS ============

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
        if (detailedAnswerMode) return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider: 'none' });
        return res.json({ suggestions: fallback, fallback: true, source: 'fallback', provider: 'none' });
      }

      const conversationState = analyzeConversationState(chatHistory, clientMessage, analysis);
      const isTrustQuestion = detectTrustQuestion(clientMessage);
      const isSafetyDosing = detectSafetyDosingQuestion(clientMessage, chatHistory);
      const isRefundOrComplaint = REFUND_COMPLAINT_RE.test(clientMessage);

      if (isTrustQuestion) console.log('✦ [AI] Trust/legitimacy question detected — proof-first mode');
      if (isSafetyDosing) console.log(`✦ [AI] Dosing question — anchor: ${conversationState.productName || 'NONE'} ${conversationState.productStrength || ''}`);
      if (isRefundOrComplaint) console.log('✦ [AI] Refund/complaint — compensation rules pinned');

      const analysisBlock = buildEnhancedAnalysisBlock(analysis, conversationState, recentContext);
      const customerContext = buildCustomerContext(customerName, customerEmail, conversationState);
      const policyBlock = buildPolicyBlock();
      const adminStyle = extractAdminStyle(chatHistory, agentStyleSamples);
      const adminStyleBlock = buildAdminStyleBlock(adminStyle);
      if (adminStyle) console.log(`✦ [AI] Style: avg ${adminStyle.avgWords}w, ${adminStyle.sampleLines.length} samples, lowercase:${adminStyle.writesLowercase}`);
      else console.log(`✦ [AI] No style yet — not enough agent replies`);

      // ── BRAIN RETRIEVAL QUERY ────────────────────────────────────────────────
      let brainSearchTerms = buildBrainQuery(clientMessage, chatHistory, conversationState);

      if (isRefundOrComplaint) {
        brainSearchTerms = `${brainSearchTerms} refund policy unshipped unfulfilled not shipped store credit e-transfer escalation cancellation replacement reship missing items delay compensation free mystery vial goodwill admin approval`;
        console.log('✦ [AI] Refund/complaint intent — augmenting brain retrieval toward refund + compensation policy');
      } else if (isSafetyDosing) {
        brainSearchTerms = `${brainSearchTerms} reconstitution bacteriostatic water mL mg/ml insulin syringe units starting dose titration weekly escalation protocol`;
        console.log('✦ [AI] Dosing intent — augmenting brain retrieval toward reconstitution/protocol');
      } else if (SHIPPING_LOCATION_RE.test(clientMessage)) {
        brainSearchTerms = `${brainSearchTerms} shipping delivery handling time dispatch pickup collection in-person order fulfillment how long to arrive shipping policy`;
        console.log('✦ [AI] Shipping/pickup/location intent — augmenting brain retrieval query');
      }

      let brainContext = '';
      let responseExamples = [];
      const needSettings = !brainSettings.length && !brainSettings.tone && !brainSettings.empathy;

      console.time('✦ [AI] brainDB');
      const [brainRes, settingsRes, exRes] = await Promise.allSettled([
        getBrainContext(db.pool, brainSearchTerms),
        needSettings ? getBrainSettings(db.pool) : Promise.resolve(null),
        db.pool.query(`SELECT brain_data -> 'responseExamples' AS examples FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`),
      ]);
      console.timeEnd('✦ [AI] brainDB');

      if (brainRes.status === 'fulfilled') brainContext = brainRes.value || '';
      else console.error('🧠 [Brain] Failed:', brainRes.reason?.message);

      if (settingsRes.status === 'fulfilled' && settingsRes.value) brainSettings = settingsRes.value;
      else if (settingsRes.status === 'rejected') console.error('🧠 [Brain] settings fetch failed:', settingsRes.reason?.message);

      if (exRes.status === 'fulfilled') responseExamples = Array.isArray(exRes.value.rows[0]?.examples) ? exRes.value.rows[0].examples : [];
      else console.error('🧠 [Brain] responseExamples fetch failed:', exRes.reason?.message);

      if (brainContext.length > MAX_BRAIN_CHARS) {
        const before = brainContext.length;
        const hoistRe = isRefundOrComplaint ? CRITICAL_POLICY_RE : isSafetyDosing ? CRITICAL_DOSING_RE : null;
        if (hoistRe) {
          const lines = brainContext.split('\n');
          const critical = [];
          const rest = [];
          for (const line of lines) (hoistRe.test(line) ? critical : rest).push(line);
          if (critical.length) {
            brainContext = [...critical, ...rest].join('\n');
            console.log(`🧠 [Brain] ${isRefundOrComplaint ? 'refund/complaint' : 'dosing'} — hoisted ${critical.length} critical line(s) before truncation`);
          }
        }
        brainContext = brainContext.slice(0, MAX_BRAIN_CHARS);
        console.log(`🧠 [Brain] truncated ${before}c → ${MAX_BRAIN_CHARS}c`);
      }

      console.log(`🧠 [Brain] ${brainContext.length} chars for: "${brainSearchTerms.substring(0, 80)}" — ${responseExamples.length} example(s)`);

      // ── CANONICAL FACTS ──────────────────────────────────────────────────────
      // NOT gated on isSafetyDosing. That gate WAS the bug: a classifier miss ("Hello"
      // on a live dosing thread) silently removed the protection instead of degrading
      // it. injectProductFacts is a no-op when a product has no confirmed facts.
      if (conversationState.productName) {
        brainContext = injectProductFacts(brainContext, conversationState.productName, MAX_BRAIN_CHARS);
      }

      // ── PRODUCT-SCOPED COVERAGE ──────────────────────────────────────────────
      const coverage = brainDosingCoverage(brainContext, conversationState.productName);
      const brainHasProductAnswer = coverage.complete;

      if (isSafetyDosing && !brainHasProductAnswer) {
        console.warn(`🚨 [Brain] DOSING GAP — no authorised rule for "${conversationState.productName || 'NO ANCHOR'}". Numbers are FORBIDDEN this turn.`);
      }

      const brainUserBlock = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nANSWER FROM BRAIN — BUILD YOUR REPLIES FROM THIS DATA FIRST\nIf the answer to the customer's question exists below, use it immediately.\nDo NOT say "let me check" or "let me get back to you" when the data is here.\nEvery figure belongs to the product named beside it. NEVER move a number from one product to another.\nNever name a product, price, timeline, or free item that does not appear below.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${brainContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` : '';

      // ============ DETAILED ANSWER MODE ============
      if (detailedAnswerMode) {
        const brainSystemSection = brainContext?.trim() ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        BRAIN RULES — READ FIRST.
        Mandatory store-owner FACTS: products, doses, protocols, policies, prices, timeframes. These override every other source of FACTS, including chat history and your own knowledge. They do NOT override the voice instructions below, say these facts the way a real person talks, not like a spec sheet.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ${brainContext}
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Use brain data as the ONLY source of truth for product info, protocols, dosing, and policies. Every number, dose, product name, and policy term must come verbatim from the matching brain rule. Every figure belongs to the product named beside it — never move a number from one product to another, no matter how plausible the arithmetic looks. Never name a product we do not sell.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ` : '';
        const imageSystemSection = imageAnalysis?.trim() ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSCREENSHOT CONTEXT — uploaded by the agent:\n${imageAnalysis.trim()}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const trustSystemSection = isTrustQuestion ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTRUST / "AM I GETTING SCAMMED" QUESTION — OVERRIDES LENGTH BELOW\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe customer fears being scammed (payment is likely e-transfer/crypto, no chargeback). A long, enthusiastic essay reads as overselling, which is a red flag here. Keep ALL three replies short and calm (2 to 4 sentences), NOT 8 to 15. Acknowledge the worry once and name why it is fair (the payment isn't reversible), then point ONLY to verification the brain data provides, quoted exactly. NEVER bare-assert legitimacy. NEVER invent a confirmation timeline. NEVER fabricate proof, review counts, years, or ratings.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : '';
        const compSystemSection = isRefundOrComplaint ? COMPENSATION_BLOCK : '';

        const safetySystemSection = !isSafetyDosing ? '' : brainHasProductAnswer
          ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDOSING / SAFETY QUESTION — HONESTY GATES OVERRIDE EVERYTHING\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe product under discussion is ${conversationState.productName}${conversationState.productStrength ? ` (${conversationState.productStrength})` : ''}. The brain above HOLDS its reconstitution and dose figures — state them, exactly as written. These gates restrict what you may INVENT; they do not license stalling.\n\nNever carry a number over from your own knowledge, from another product, or from the chat history. Never do arithmetic on top of the brain's numbers. Never say a dose "is safe" or "you'll be fine", and never promise an outcome unless the brain states it.\n\nPoint to a healthcare provider ONLY if the customer actually raised getting sick, side effects, a health condition, pregnancy, or other medications. NEVER reference a symptom they never mentioned.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          : `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 DOSING QUESTION, NO DATA FOR THIS PRODUCT — NUMBERS ARE FORBIDDEN\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe brain above has NO reconstitution volume, concentration, or unit math for ${conversationState.productName || 'the product being asked about'}. It DOES have those figures for OTHER products. Those belong to those products. You may not borrow, scale, adapt, or infer from them.\n\nA "1mL" beside a product in a SYRINGE spec ("1mL 29G insulin syringe") is a barrel size, NOT a reconstitution volume.\n\nBanned in all three replies: any mL volume, any mg/mL concentration, any syringe unit count. Say honestly that you're confirming the exact protocol and coming straight back.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        const systemPrompt = `${trustSystemSection}${safetySystemSection}${compSystemSection}${brainSystemSection}${imageSystemSection}${adminStyleBlock ? `${adminStyleBlock}\n\n` : ''}You are ghostwriting detailed replies for a human support agent. All three styles must sound like the SAME person.\n\nWrite like a real person typing in a support chat, not like an AI. Never use em dashes or double hyphens (--) anywhere. No essay-style transitions. Short, natural sentences.\n\nNO fake time promises: state a shipping, handling, or delivery timeframe ONLY if it appears in the brain data above, quoted exactly. Never invent tracking status, stock, or pickup options.\n\nNever attribute a statement, symptom, or concern to the customer that they did not actually make. Never name a product, price, or free item that is not in the brain data.\n\nWrite three distinct, highly detailed replies (8–15 sentences each) in flowing paragraphs. No bullet points.\n\n${policyBlock ? `Policies:\n${policyBlock}\n` : ''}${customerContext ? `Customer context:\n${customerContext}\n` : ''}${analysisBlock ? `Conversation analysis:\n${analysisBlock}\n` : ''}\nEmpathetic: Deep emotional validation first, then full answer with warmth.\nThorough: Every product detail, step, policy, and expectation. Nothing unanswered.\nAbove & Beyond: Everything in Thorough plus extras — tips, related products, follow-up offer.\n\nYour response MUST END with the JSON object and nothing after it. Return ONLY valid JSON:\n{\n  "detailedAnswers": [\n    { "label": "Empathetic",     "text": "..." },\n    { "label": "Thorough",       "text": "..." },\n    { "label": "Above & Beyond", "text": "..." }\n  ]\n}`;

        const userPrompt = `${brainUserBlock}Conversation history:\n${chatHistory || '(none)'}\n\nCustomer's message:\n${clientMessage}${adminNote ? `\nAdmin note: ${adminNote}` : ''}\n\nWrite 3 detailed replies. Your response must END with the JSON, nothing after it.`;
        const requestBody = JSON.stringify({ model: DETAILED_MODEL, max_tokens: 3000, temperature: 0.5, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] });

        console.time('✦ [AI] llmDetailed');
        const { data: anthropicData, provider } = await callAIForSuggestions(requestBody, ANTHROPIC_API_KEY);
        console.timeEnd('✦ [AI] llmDetailed');

        const rawContent = anthropicData.content?.[0]?.text || '';
        console.log(`✦ [AI] Detailed raw (first 300): ${rawContent.substring(0, 300)}`);
        const parsed = parseAIResponse(rawContent, 'detailedAnswers');
        if (!parsed) {
          const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
          return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider });
        }
        let detailedAnswers = Array.isArray(parsed.detailedAnswers) ? parsed.detailedAnswers.slice(0, 3) : null;
        if (!detailedAnswers) {
          console.warn('✦ [AI] Detailed parsed but detailedAnswers not an array — serving fallback');
          const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
          return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider });
        }

        // Essay mode is MORE prone to both failures — 8-15 sentences gives it far more
        // room to helpfully "fill in" a ratio or invent a goodwill gesture.
        const texts = detailedAnswers.map(a => a?.text || '');
        const { contaminated } = detectNumberContamination(texts, brainContext, conversationState.productName);
        const { blocked: cBlocked } = validateCommitments(texts, brainContext);
        if (contaminated.length || cBlocked.length) {
          const why = contaminated.length ? 'number_contamination' : 'unauthorised_commitment';
          console.error(`🚨 [AI] Detailed mode blocked (${why}) — serving fallback rather than a borrowed dose or an invented promise`);
          const fallback = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
          return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider, blocked: why });
        }

        detailedAnswers.forEach(a => { if (a?.text) a.text = humanizeText(a.text); });
        return res.json({ detailedAnswers, fallback: false, source: 'ai', provider });
      }

      // ============ FAST SUGGESTION MODE ============
      const systemPrompt = buildSystemPrompt(
        storeName, customerContext, analysisBlock, policyBlock, contextQuality, messageRichness,
        brainContext, brainSettings, adminStyleBlock, imageAnalysis,
        conversationState?.sentiment || analysis?.sentiment || 'neutral',
        responseExamples, isTrustQuestion, isSafetyDosing, brainHasProductAnswer
      ) + (isRefundOrComplaint ? COMPENSATION_BLOCK : '') + JSON_HARDENING_SUFFIX;

      const userPrompt = buildUserPrompt(
        chatHistory, clientMessage, messageEdited, adminNote, conversationState, recentContext,
        brainContext, imageAnalysis || '', brainHasProductAnswer
      );

      const buildBody = (prompt) => JSON.stringify({ model: SUGGEST_MODEL, max_tokens: SUGGEST_MAX_TOKENS, temperature: 0.6, system: systemPrompt, messages: [{ role: 'user', content: prompt }] });

      console.log(`✦ [AI] Calling suggestions (DeepSeek primary / ${SUGGEST_MODEL} fallback) — brain: ${brainContext.length}c, style: ${adminStyleBlock.length}c, examples: ${responseExamples.length}, image: ${!!imageAnalysis}, productAnswer: ${brainHasProductAnswer}`);
      console.time('✦ [AI] llmSuggest');
      const { data: anthropicData, provider } = await callAIForSuggestions(buildBody(userPrompt), ANTHROPIC_API_KEY);
      console.timeEnd('✦ [AI] llmSuggest');

      const rawContent = anthropicData.content?.[0]?.text || '';
      console.log(`✦ [AI] Served by: ${provider} — Raw (first 300): ${rawContent.substring(0, 300)}`);

      let usedFallback = false;
      let blocked = null;
      let safetyReview = [];

      const parsed = parseAIResponse(rawContent, 'suggestions');
      if (!parsed) {
        console.error(`✦ [AI] JSON parse failed (provider=${provider}). Raw:`, rawContent.substring(0, 500));
        return res.json({ suggestions: generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote), fallback: true, source: 'fallback', provider });
      }

      let suggestions;
      if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions.slice(0, 3);
      else if (Array.isArray(parsed)) suggestions = parsed.slice(0, 3);
      else { suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote); usedFallback = true; }

      console.log(`✦ [AI] BEFORE VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
      if (!usedFallback) {
        suggestions = validateSuggestions(suggestions, conversationState, chatHistory);
        console.log(`✦ [AI] AFTER VALIDATE (${suggestions.length}):`, JSON.stringify(suggestions));
      }

      // ── CONTAMINATION BLOCK — RUNS ON EVERY TURN ─────────────────────────────
      // NOT behind isSafetyDosing. A safety check gated on a classifier is fail-open:
      // one misclassification and the protection is gone, not weakened. That is exactly
      // how five consecutive dosing tables shipped while the classifier said "not a
      // dosing question". This check is pure-local and free. It always runs.
      if (!usedFallback) {
        const { clean, contaminated } = detectNumberContamination(suggestions, brainContext, conversationState.productName);
        if (contaminated.length) {
          blocked = 'number_contamination';
          suggestions = clean;
          if (!suggestions.length) {
            console.error('🚨 [AI] Every suggestion carried an unauthorised dosing number — serving honest fallback');
            suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
          }
        }

        // If there is NO authorised answer for this product, no surviving suggestion may
        // state a volume or a concentration. Regardless of turn classification.
        if (!brainHasProductAnswer && !usedFallback) {
          const SYRINGE = /\d+(?:\.\d+)?\s*mL\s*(?:\/\s*\d+\s*[-\s]?unit)?[^.]{0,25}?\d{2}\s*G|\b1\s*mL\s*\/\s*100\s*[-\s]?unit\b/gi;
          const leaked = suggestions.filter(s => {
            const t = String(s).replace(SYRINGE, ' ');
            return /\b[\d.]+\s*mL\b/i.test(t) || /\b[\d.]+\s*(?:mg|mcg|iu)\s*\/\s*mL\b/i.test(t);
          });
          if (leaked.length) {
            console.error(`🚨 [AI] COVERAGE=false for ${conversationState.productName || 'NO ANCHOR'} but ${leaked.length} suggestion(s) still state a dose. Serving fallback.`);
            leaked.forEach(s => console.error(`   leaked: "${String(s).slice(0, 110)}"`));
            suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
            blocked = 'unauthorised_dose_leak';
          }
        }
      }

      // ── COMMITMENT BLOCK — ALSO RUNS ON EVERY TURN ───────────────────────────
      // Invented products and unauthorised free-product offers are BLOCKED. Remedies the
      // brain never backed (shipping refund, discount, expedite, cancellation) are FLAGGED
      // for the agent, not removed — those are judgement calls a human may make, they just
      // must not be pre-written by a model with no basis for them.
      if (!usedFallback) {
        const { clean, blocked: cBlocked, review } = validateCommitments(suggestions, brainContext);
        if (cBlocked.length) {
          blocked = blocked || 'unauthorised_commitment';
          suggestions = clean;
          if (!suggestions.length) {
            console.error('🚨 [AI] Every suggestion made an unauthorised promise — serving honest fallback');
            suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
            usedFallback = true;
          }
        }
        if (review.length) safetyReview = [...safetyReview, ...review];
      }

      // ── STALL GUARD ──────────────────────────────────────────────────────────
      if (!usedFallback && !blocked) {
        const { stalled } = detectStall(suggestions, { isSafetyDosing, brainHasProductAnswer });
        if (stalled) {
          try {
            console.time('✦ [AI] llmStallRetry');
            const retry = await callAIForSuggestions(buildBody(userPrompt + STALL_RETRY_INSTRUCTION), ANTHROPIC_API_KEY);
            console.timeEnd('✦ [AI] llmStallRetry');
            const retryParsed = parseAIResponse(retry.data.content?.[0]?.text || '', 'suggestions');
            const retrySuggestions = Array.isArray(retryParsed?.suggestions) ? retryParsed.suggestions.slice(0, 3) : null;
            if (retrySuggestions?.length) {
              let cleaned = validateSuggestions(retrySuggestions, conversationState, chatHistory);
              // The retry is under explicit pressure to produce numbers — re-check both guards.
              cleaned = detectNumberContamination(cleaned, brainContext, conversationState.productName).clean;
              cleaned = validateCommitments(cleaned, brainContext).clean;
              if (cleaned.length) {
                suggestions = cleaned;
                console.log(`✦ [AI] STALL RETRY OK (${cleaned.length}):`, JSON.stringify(cleaned));
              }
            }
          } catch (retryErr) {
            console.error('✦ [AI] Stall retry failed, keeping original:', retryErr.message);
          }
        }
      }

      if (!usedFallback && suggestions.length === 0) {
        console.log('✦ [AI] All suggestions filtered — using fallback');
        suggestions = generateSmartFallbackSuggestions(clientMessage, chatHistory, analysis, adminNote);
        usedFallback = true;
      }

      // ── SAFETY GATE ──────────────────────────────────────────────────────────
      // Before humanizeText, so any appended line gets scrubbed too. clientMessage is
      // REQUIRED: the provider pointer fires only if the customer raised a real health
      // flag. The old version hardcoded "since you mentioned not feeling great on a
      // higher dose" onto every dosing reply, inventing a symptom out of nothing.
      if (isSafetyDosing && !usedFallback) {
        const result = validateSafetyDosing(suggestions, clientMessage);
        suggestions  = result.suggestions;
        safetyReview = [...safetyReview, ...result.needsReview];
      }

      suggestions = suggestions.map(humanizeText);

      res.json({
        suggestions,
        fallback: usedFallback,
        source: usedFallback ? 'fallback' : 'ai',
        provider,
        needsReview: safetyReview,
        ...(blocked && { blocked }),
        ...(isSafetyDosing && { coverage: { product: coverage.product, complete: coverage.complete } }),
      });

    } catch (error) {
      console.error('✦ [AI] Endpoint error:', error.message, error.stack);
      const fallback = generateSmartFallbackSuggestions(req.body?.clientMessage || '', req.body?.chatHistory || '', req.body?.analysis || {}, req.body?.adminNote || '');
      if (req.body?.detailedAnswerMode) {
        return res.json({ detailedAnswers: detailedFromFallback(fallback), fallback: true, source: 'fallback', provider: 'none' });
      }
      res.json({ suggestions: fallback, fallback: true, source: 'fallback', provider: 'none' });
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

  // Dry-run retrieval + coverage. Proves whether a dosing miss is an anchoring problem
  // or a genuine data gap, without burning an LLM call.
  router.post('/brain-debug/query', authenticateToken, async (req, res) => {
    try {
      const { clientMessage = '', chatHistory = '' } = req.body;
      const state = analyzeConversationState(chatHistory, clientMessage, {});
      const query = buildBrainQuery(clientMessage, chatHistory, state);
      const context = (await getBrainContext(db.pool, query)) || '';
      const coverage = brainDosingCoverage(context, state.productName);
      return res.json({
        productAnchor: state.productName,
        strengthAnchor: state.productStrength,
        query,
        isSafetyDosing: detectSafetyDosingQuestion(clientMessage, chatHistory),
        brainChars: context.length,
        coverage,
        verdict: coverage.complete
          ? "Brain HAS this product's dosing data — the model may state numbers."
          : 'Brain has NO dosing data for this product — numbers are forbidden. Author the entry.',
        brainPreview: context.slice(0, 1200),
      });
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