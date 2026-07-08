
const BRAIN_TTL = 30 * 1000; // 30s — short enough to feel fresh, long enough to avoid hammering DB

// ── Topic detection ───────────────────────────────────────────────────────────

const TOPIC_PATTERNS = {
  recommendation: /recommend|suggest|best for|good for|help with|goal|looking for|want to|trying to|lose weight|weight loss|fat loss|burn fat|muscle|build|anti.?aging|healing|recovery|sleep|energy|libido|cognitive|focus|what (peptide|product|should)|which (peptide|product)|what do you (have|offer|carry|sell)/i,
  dosing:         /dose|dosing|dosage|reconstitut|bac water|inject|vial|mix|dilut|mg|mcg|unit|syringe|needle|how (do|to) use|how much|subcutan|administr/i,
  shipping:       /ship|track|deliver|delay|usps|canada post|transit|in transit|stuck|where is|package|parcel|carrier|courier|estimated|arrival|dispatch|business day/i,
  refund:         /refund|return|cancel|money back|charge|chargeback|credit|reimburse|dispute/i,
  order:          /order|status|confirm|invoice|purchased|bought|receipt|processing|fulfil/i,
  payment:        /payment|pay|paid|card|declined|checkout|billing|charge|transaction/i,
  product:        /bpc|tb-500|sema|tirzep|cjc|ipamorelin|hgh|nad|ghk|wolverine|peptide|product|item|vial|kit|blend/i,
  storage:        /storage|store|refrigerat|freezer|fridge|temperature|shelf life|expir|stable/i,
  french:         /bonjour|merci|svp|s'il vous|monsieur|madame|commander|livraison|remboursement/i,
  coa:            /coa|certificate|analysis|purity|test|lab|hplc|third.party/i,
  legal:          /lawyer|attorney|sue|lawsuit|legal|court|bbb|complaint|report|expose|media|news|scam|fraud|fake|cheat|steal|threaten/i,
  pickup:         /pick.?up|walk.?in|local|in.?person|visit|store|address|location|office|warehouse/i,
  missing:        /missing|didn.?t receive|not in|not included|wrong item|wrong product|wrong dose|short.?shipped|incomplete/i,
};

function detectTopic(msg = '') {
  if (!msg) return 'general';
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(msg)) return topic;
  }
  return 'general';
}

// Detect ALL matching topics (not just first match) for richer context
function detectAllTopics(msg = '') {
  if (!msg) return ['general'];
  const matched = [];
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(msg)) matched.push(topic);
  }
  return matched.length ? matched : ['general'];
}

// ── Known product names ───────────────────────────────────────────────────────

const KNOWN_PRODUCTS = [
  'retatrutide','reta','semaglutide','sema','ozempic','wegovy',
  'tirzepatide','tirz','mounjaro','bpc-157','bpc157','bpc',
  'tb-500','tb500','cjc-1295','cjc1295','cjc','ipamorelin','ipa',
  'ghk-cu','ghkcu','ghk','tesamorelin','tesa','sermorelin',
  'nad+','nad','wolverine','glow','klow','mots-c','motsc',
  'pt-141','pt141','selank','semax','epithalon',
  'bac water','bacteriostatic','reconstitution solution','recon water',
  'survodutide','cagrilintide','kisspeptin','follistatin','adipotide',
  'aicar','epo','cerebrolysin','hexarelin','ghrp','igf','mgf',
  'triptorelin','thymalin','pinealon','oxytocin','vip','ara-290',
  'ss-31','elamipretide','slu-pp-332','gonadorelin','hcg','hmg',
  'lipo-c','dsip','hyaluronic','botulinum','5-amino','1mq',
];

function extractExactTerms(msg) {
  const lower = (msg || '').toLowerCase();
  return KNOWN_PRODUCTS.filter(p => lower.includes(p));
}


function normaliseRule(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return raw.trim() ? { text: raw.trim(), source: 'auto-analysis', golden: false } : null;
  }
  if (typeof raw === 'object' && raw.text) {
    const source = raw.source || 'auto-analysis';
    const golden =
      source === 'admin-feedback'           ||
      source === 'admin-upload'             ||
      source === 'admin-training'           ||
      source === 'admin-chat'               || 
      source === 'admin-consolidation-audit';
    return { text: String(raw.text).trim(), source, golden, confidence: raw.confidence || 'normal' };
  }
  return null;
}

// ── Dedup ─────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'never','always','dont','do','not','the','a','an','if','when','to','for',
  'in','is','are','and','or','with','of','that','this','their','your','has',
  'have','already','from','about','ask','customer','customers','order','number',
  'message','provided','information','response','use','make','should','would',
  'they','you','them','been','will','just','then','than','only','very',
  'same','again','once','provide','please','given','earlier',
]);

function keywords(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function similarity(a, b) {
  const ka = new Set(keywords(a));
  const kb = new Set(keywords(b));
  if (!ka.size || !kb.size) return 0;
  let overlap = 0;
  for (const w of ka) if (kb.has(w)) overlap++;
  return overlap / Math.max(ka.size, kb.size);
}

function deduplicate(rules, max, threshold, globalSeen = []) {
  const kept = [];
  for (const raw of rules) {
    const rule = normaliseRule(raw);
    if (!rule || rule.text.length < 15) continue;
    const isDupe =
      kept.some(k => similarity(k.text, rule.text) >= threshold) ||
      globalSeen.some(k => similarity(k.text, rule.text) >= threshold);
    if (!isDupe) {
      kept.push(rule);
      globalSeen.push(rule);
    }
    if (kept.length >= max) break;
  }
  return kept;
}

function scoreRelevance(entryText, msgKeywords, exactTerms) {
  if (!entryText) return 0;
  const lower = entryText.toLowerCase();

  // Exact product name match — strongest signal
  let exactMatches = 0;
  for (const t of exactTerms) if (lower.includes(t)) exactMatches++;

  // Keyword overlap — medium signal
  let kwMatches = 0;
  for (const kw of msgKeywords) if (lower.includes(kw)) kwMatches++;

  const exactScore = exactTerms.length  > 0 ? (exactMatches / exactTerms.length)  * 0.7 : 0;
  const kwScore    = msgKeywords.length > 0 ? (kwMatches    / msgKeywords.length)  * 0.3 : 0;
  return exactScore + kwScore;
}

// Sort ANY array of rules by relevance to the customer message
function sortByRelevance(rules, customerMessage) {
  if (!customerMessage || !rules.length) return rules;
  const msgKeywords = keywords(customerMessage);
  const exactTerms  = extractExactTerms(customerMessage);

  // Even with no product terms, keyword scoring still differentiates rules
  return [...rules]
    .map(raw => {
      const rule = normaliseRule(raw);
      return { raw, score: rule ? scoreRelevance(rule.text, msgKeywords, exactTerms) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.raw);
}

// ── Golden rule extraction ────────────────────────────────────────────────────

const TOPIC_GOLDEN_ORDER = {
  shipping: ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  refund:   ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  order:    ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  missing:  ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  pickup:   ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  legal:    ['toneRules', 'customPolicies', 'avoidPatterns', 'preferPatterns', 'productKnowledge'],
  dosing:   ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  french:   ['toneRules', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'productKnowledge'],
  coa:      ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
};
const DEFAULT_GOLDEN_ORDER = ['avoidPatterns', 'customPolicies', 'preferPatterns', 'toneRules', 'productKnowledge'];

function extractGoldenRules(brain, topic, customerMessage, globalSeen) {
  const order = TOPIC_GOLDEN_ORDER[topic] || DEFAULT_GOLDEN_ORDER;
  const msgKw = keywords(customerMessage);
  const exactTerms = extractExactTerms(customerMessage);

  const candidates = [];
  for (const cat of order) {
    const rules = brain[cat];
    if (!Array.isArray(rules)) continue;
    for (const raw of rules) {
      const rule = normaliseRule(raw);
      if (rule?.golden) candidates.push({ rule, cat, score: scoreRelevance(rule.text, msgKw, exactTerms) });
    }
  }

  // Sort by relevance within each category ordering
  // Product knowledge sorted purely by score; others preserve category order but sort within
  const sorted = candidates.sort((a, b) => {
    const catA = order.indexOf(a.cat);
    const catB = order.indexOf(b.cat);
    if (catA !== catB) return catA - catB;           // respect topic category order
    return b.score - a.score;                         // within same cat, most relevant first
  });

  const golden = [];
  for (const { rule } of sorted) {
    const isDupe =
      golden.some(g => similarity(g.text, rule.text) >= 0.35) ||
      globalSeen.some(g => similarity(g.text, rule.text) >= 0.35);
    if (!isDupe) {
      golden.push(rule);
      globalSeen.push(rule);
    }
    if (golden.length >= 12) break;
  }
  return golden;
}

// ── Topic config ──────────────────────────────────────────────────────────────

const TOPIC_PRIORITY = {
  recommendation: ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  dosing:         ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
  shipping:       ['customPolicies', 'preferPatterns', 'avoidPatterns', 'productKnowledge', 'toneRules'],
  refund:         ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  order:          ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  missing:        ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  payment:        ['customPolicies', 'avoidPatterns', 'preferPatterns', 'toneRules', 'productKnowledge'],
  product:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  storage:        ['productKnowledge', 'preferPatterns', 'customPolicies', 'avoidPatterns', 'toneRules'],
  french:         ['toneRules', 'preferPatterns', 'avoidPatterns', 'customPolicies', 'productKnowledge'],
  coa:            ['productKnowledge', 'customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules'],
  legal:          ['toneRules', 'customPolicies', 'avoidPatterns', 'preferPatterns', 'productKnowledge'],
  pickup:         ['customPolicies', 'preferPatterns', 'avoidPatterns', 'toneRules', 'productKnowledge'],
  general:        ['productKnowledge', 'preferPatterns', 'avoidPatterns', 'toneRules', 'customPolicies'],
};

const TOPIC_CAPS = {
  recommendation: [5, 3, 2, 2, 1],
  dosing:         [5, 3, 2, 2, 1],
  shipping:       [2, 3, 3, 2, 1],
  refund:         [2, 3, 3, 2, 1],
  order:          [2, 3, 3, 2, 1],
  missing:        [2, 3, 3, 2, 1],
  payment:        [1, 3, 3, 2, 1],
  product:        [5, 3, 2, 2, 1],
  storage:        [5, 3, 2, 2, 1],
  coa:            [3, 3, 2, 2, 1],
  legal:          [1, 2, 3, 3, 2],
  pickup:         [1, 3, 3, 2, 1],
  french:         [1, 3, 2, 2, 3],
  general:        [3, 3, 2, 2, 1],
};

const CATEGORY_THRESHOLDS = {
  avoidPatterns:    0.30,
  toneRules:        0.35,
  customPolicies:   0.40,
  preferPatterns:   0.45,
  productKnowledge: 0.70,
};

const CATEGORY_META = {
  productKnowledge: { label: 'PRODUCT FACTS',  prefix: '•' },
  customPolicies:   { label: 'STORE POLICIES', prefix: '•' },
  preferPatterns:   { label: 'ALWAYS DO',      prefix: '✓' },
  avoidPatterns:    { label: 'NEVER DO',       prefix: '✗' },
  toneRules:        { label: 'TONE',           prefix: '•' },
  responseExamples: { label: 'EXAMPLE REPLY', prefix: '"' },
};

// ── Main formatter ────────────────────────────────────────────────────────────

function formatBrainContext(brain, topic = 'general', customerMessage = '') {
  if (!brain) return '';

  const priority   = TOPIC_PRIORITY[topic] || TOPIC_PRIORITY.general;
  const caps       = TOPIC_CAPS[topic]     || TOPIC_CAPS.general;
  const globalSeen = [];
  const sections   = [];

  const msgKw      = keywords(customerMessage);
  const exactTerms = extractExactTerms(customerMessage);

  // ── 1. Golden rules ───────────────────────────────────────────────────────
  // Admin-written rules always injected first.
  // Sorted by relevance to this specific message within their category order.
  const goldenRules = extractGoldenRules(brain, topic, customerMessage, globalSeen);
  if (goldenRules.length) {
    sections.push('GOLDEN RULES (non-negotiable — admin-set):');
    goldenRules.forEach(r => sections.push(`⚡ ${r.text}`));
  }

  // ── 2. Topic-specific supplementary context ───────────────────────────────
  // FIX: ALL categories now sorted by relevance, not just productKnowledge.
  // auto-analysis rules ranked by how well they match this specific message
  // before the cap is applied — so the most relevant ones always make it in.
  const label = exactTerms.length > 0
    ? `\nCONTEXT [${topic.toUpperCase()} — ${exactTerms.join(', ')}]:`
    : `\nCONTEXT [${topic.toUpperCase()}]:`;
  sections.push(label);

  let hasSupplementary = false;
  priority.forEach((categoryKey, idx) => {
    const rawRules = brain[categoryKey];
    if (!Array.isArray(rawRules) || rawRules.length === 0) return;

    const cap       = caps[idx] ?? 1;
    const threshold = CATEGORY_THRESHOLDS[categoryKey] ?? 0.45;

    // ✅ FIX: Sort by relevance FIRST for ALL categories, then apply cap
    // Previously only productKnowledge was sorted — now everything is
    const sorted = sortByRelevance(rawRules, customerMessage);

    // Auto-analysis only — golden rules already handled above
    const autoOnly = sorted.filter(raw => {
      const r = normaliseRule(raw);
      return r && !r.golden;
    });

    const deduped = deduplicate(autoOnly, cap, threshold, globalSeen);
    if (!deduped.length) return;

    const meta = CATEGORY_META[categoryKey];
    if (!meta) return;

    sections.push(`\n${meta.label}:`);
    deduped.forEach(r => sections.push(`${meta.prefix} ${r.text}`));
    hasSupplementary = true;
  });

  if (!hasSupplementary) sections.push('(no additional context for this topic)');

  // ── 3. Most relevant example reply ───────────────────────────────────────
  if (brain.responseExamples?.length) {
    const sorted  = sortByRelevance(brain.responseExamples, customerMessage);
    const deduped = deduplicate(sorted, 1, 0.4, globalSeen);
    if (deduped.length) {
      sections.push(`\nEXAMPLE REPLY:`);
      sections.push(`"${deduped[0].text}"`);
    }
  }

  return sections.join('\n');
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// FIX: fingerprint now uses a hash of the full message text so every unique
// customer inquiry gets its own cached context — no more two different
// questions sharing identical generic context just because they share a topic.
//
// TTL reduced 5min → 30s so context feels fresh without hammering the DB.
// At 30s, rapid re-fetches still hit cache but a new question always gets
// freshly computed relevant context within half a minute.

const _cache = {};

function hashMessage(msg) {
  // Simple non-crypto hash — good enough for cache keying
  let h = 0;
  for (let i = 0; i < msg.length; i++) {
    h = (Math.imul(31, h) + msg.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function fingerprint(msg) {
  const topic      = detectTopic(msg);
  const exactTerms = extractExactTerms(msg).sort().join(',');
  const msgHash    = hashMessage(msg.toLowerCase().trim());
  // Include topic + product terms for readability in logs,
  // plus full message hash to guarantee uniqueness
  return `${topic}::${exactTerms}::${msgHash}`;
}

async function getBrainContext(pool, customerMessage = '') {
  const topic = detectTopic(customerMessage);
  const fp    = fingerprint(customerMessage);
  const now   = Date.now();

  const cached = _cache[fp];
  if (cached && (now - cached.time) < BRAIN_TTL) {
    console.log(`🧠 [Brain] cache hit — ${fp}, ${cached.value.length} chars`);
    return cached.value;
  }

  try {
    const result = await pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );

    if (!result.rows.length || !result.rows[0].brain_data) {
      console.log(`🧠 [Brain] no data in db`);
      _cache[fp] = { value: '', time: now };
      return '';
    }

    const brain = result.rows[0].brain_data;

    const sizes = Object.entries(brain)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}:${v.length}`)
      .join(', ');
    console.log(`🧠 [Brain] DB — ${sizes || 'none'}`);

    const context   = formatBrainContext(brain, topic, customerMessage);
    const lineCount = context.split('\n').length;
    console.log(`🧠 [Brain] fp=${fp} → ${context.length} chars, ${lineCount} lines`);

    if (context.length < 50) {
      console.warn(`🧠 [Brain] WARNING: very short context — check brain data`);
    }

    _cache[fp] = { value: context, time: now };
    return context;

  } catch (err) {
    console.error('[Brain] Failed to load:', err.message);
    _cache[fp] = { value: '', time: now };
    return '';
  }
}

function refreshBrainCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
  console.log('🧠 [Brain] All caches cleared');
}

async function getBrainSettings(pool) {
  try {
    const result = await pool.query(
      `SELECT brain_data FROM ai_training_brain ORDER BY updated_at DESC LIMIT 1`
    );
    const brain = result.rows[0]?.brain_data;
    return brain?.suggestionSettings || {};
  } catch {
    return {};
  }
}

module.exports = { getBrainContext, refreshBrainCache, getBrainSettings };