


// // backend/lib/deepseek-fallback.js
// //
// // Provider-key storage (DB-backed, env-var fallback) + DeepSeek fallback
// // for when the Anthropic API is rate-limited or the account is out of credit.

// const db = require('../database');

// // ─────────────────────────────────────────────────────────────────────────
// // Key storage
// // ─────────────────────────────────────────────────────────────────────────

// async function ensureProviderKeysTable() {
//   await db.pool.query(`
//     CREATE TABLE IF NOT EXISTS api_provider_keys (
//       provider TEXT PRIMARY KEY,
//       api_key TEXT NOT NULL,
//       updated_at TIMESTAMPTZ DEFAULT NOW(),
//       updated_by TEXT
//     )
//   `);
// }

// async function getProviderKey(provider, envFallbackVar) {
//   try {
//     await ensureProviderKeysTable();
//     const r = await db.pool.query(
//       `SELECT api_key FROM api_provider_keys WHERE provider = $1`,
//       [provider]
//     );
//     if (r.rows[0]?.api_key) return r.rows[0].api_key;
//   } catch (err) {
//     console.error(`[API Keys] getProviderKey(${provider}) error:`, err.message);
//   }
//   return envFallbackVar ? (process.env[envFallbackVar] || null) : null;
// }

// async function saveProviderKey(provider, apiKey, updatedBy) {
//   await ensureProviderKeysTable();
//   await db.pool.query(`
//     INSERT INTO api_provider_keys (provider, api_key, updated_at, updated_by)
//     VALUES ($1, $2, NOW(), $3)
//     ON CONFLICT (provider) DO UPDATE
//       SET api_key = EXCLUDED.api_key,
//           updated_at = EXCLUDED.updated_at,
//           updated_by = EXCLUDED.updated_by
//   `, [provider, apiKey, updatedBy]);
// }

// async function deleteProviderKey(provider) {
//   await ensureProviderKeysTable();
//   await db.pool.query(`DELETE FROM api_provider_keys WHERE provider = $1`, [provider]);
// }

// function maskKey(key) {
//   if (!key) return null;
//   if (key.length <= 8) return '••••••••';
//   return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
// }

// // ─────────────────────────────────────────────────────────────────────────
// // Failure detection
// // ─────────────────────────────────────────────────────────────────────────

// const CREDIT_EXHAUSTED_PATTERNS = [
//   /credit balance is too low/i,
//   /plans\s*&\s*billing/i,
//   /insufficient_quota/i,
// ];

// function isCreditExhaustedError(message) {
//   return CREDIT_EXHAUSTED_PATTERNS.some(rx => rx.test(message || ''));
// }

// // ─────────────────────────────────────────────────────────────────────────
// // DeepSeek fallback call
// // ─────────────────────────────────────────────────────────────────────────

// async function tryDeepSeekFallback(anthropicRequestBodyStr) {
//   const DEEPSEEK_TIMEOUT_MS = 60000; // fail into Claude after 60s
//   try {
//     const deepseekKey = await getProviderKey('deepseek', 'DEEPSEEK_API_KEY');
//     if (!deepseekKey) {
//       console.warn('[AI] No DeepSeek key configured — cannot fall back');
//       return null;
//     }

//     const parsed = JSON.parse(anthropicRequestBodyStr);

//     const hasImages = (parsed.messages || []).some(m =>
//       Array.isArray(m.content) && m.content.some(c => c.type === 'image')
//     );
//     if (hasImages) {
//       console.warn('[AI] Request contains image content — DeepSeek fallback not attempted');
//       return null;
//     }

//     const flatten = (content) => {
//       if (typeof content === 'string') return content;
//       if (Array.isArray(content)) {
//         return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
//       }
//       return '';
//     };

//     const deepseekMessages = [];
//     if (parsed.system) deepseekMessages.push({ role: 'system', content: parsed.system });
//     (parsed.messages || []).forEach(m => {
//       deepseekMessages.push({ role: m.role, content: flatten(m.content) });
//     });

//     const res = await fetch('https://api.deepseek.com/chat/completions', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${deepseekKey}`,
//       },
//       body: JSON.stringify({
//         model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
//         max_tokens: Math.min(parsed.max_tokens || 2000, 8192),
//         temperature: parsed.temperature ?? 1.0,
//         reasoning_effort: parsed._reasoningEffort || 'low',
//         messages: deepseekMessages,
//       }),
//       signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
//     });

//     const text = await res.text();
//     if (!res.ok) {
//       console.error(`[AI] DeepSeek fallback failed: ${res.status} ${text.slice(0, 300)}`);
//       return null;
//     }

//     const data = JSON.parse(text);
//     const choice = data.choices?.[0] || {};
//     const finish = choice.finish_reason ?? '?';
//     console.log(`[AI] DeepSeek model=${data.model || 'unknown'} tokens=${data.usage?.total_tokens ?? '?'} completion=${data.usage?.completion_tokens ?? '?'} finish=${finish}`);

//     const content = choice.message?.content
//       || choice.message?.reasoning_content
//       || '';

//     if (!content) {
//       console.error(`[AI] DeepSeek returned no content (finish=${finish}). Body: ${text.slice(0, 500)}`);
//       return null;
//     }

//     console.log('[AI] DeepSeek fallback succeeded');
//     const stopReasonMap = { stop: 'end_turn', length: 'max_tokens', content_filter: 'end_turn', tool_calls: 'tool_use' };

//     return {
//       content: [{ type: 'text', text: content }],
//       stop_reason: stopReasonMap[finish] || finish,
//       _fallbackProvider: 'deepseek',
//     };
//   } catch (err) {
//     const label = err.name === 'TimeoutError' || err.name === 'AbortError'
//       ? `timeout (${DEEPSEEK_TIMEOUT_MS / 1000}s)`
//       : err.message;
//     console.error('[AI] DeepSeek fallback error:', label);
//     return null;
//   }
// }

// module.exports = {
//   ensureProviderKeysTable,
//   getProviderKey,
//   saveProviderKey,
//   deleteProviderKey,
//   maskKey,
//   isCreditExhaustedError,
//   tryDeepSeekFallback,
// };










// backend/lib/deepseek-fallback.js
//
// Provider-key storage (DB-backed, env-var fallback) + DeepSeek fallback
// for when the Anthropic API is rate-limited or the account is out of credit.

const db = require('../database');

// ─────────────────────────────────────────────────────────────────────────
// Key storage
// ─────────────────────────────────────────────────────────────────────────

async function ensureProviderKeysTable() {
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS api_provider_keys (
      provider TEXT PRIMARY KEY,
      api_key TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT
    )
  `);
}

async function getProviderKey(provider, envFallbackVar) {
  try {
    await ensureProviderKeysTable();
    const r = await db.pool.query(
      `SELECT api_key FROM api_provider_keys WHERE provider = $1`,
      [provider]
    );
    if (r.rows[0]?.api_key) return r.rows[0].api_key;
  } catch (err) {
    console.error(`[API Keys] getProviderKey(${provider}) error:`, err.message);
  }
  return envFallbackVar ? (process.env[envFallbackVar] || null) : null;
}

async function saveProviderKey(provider, apiKey, updatedBy) {
  await ensureProviderKeysTable();
  await db.pool.query(`
    INSERT INTO api_provider_keys (provider, api_key, updated_at, updated_by)
    VALUES ($1, $2, NOW(), $3)
    ON CONFLICT (provider) DO UPDATE
      SET api_key = EXCLUDED.api_key,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
  `, [provider, apiKey, updatedBy]);
}

async function deleteProviderKey(provider) {
  await ensureProviderKeysTable();
  await db.pool.query(`DELETE FROM api_provider_keys WHERE provider = $1`, [provider]);
}

function maskKey(key) {
  if (!key) return null;
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Failure detection
// ─────────────────────────────────────────────────────────────────────────

const CREDIT_EXHAUSTED_PATTERNS = [
  /credit balance is too low/i,
  /plans\s*&\s*billing/i,
  /insufficient_quota/i,
];

function isCreditExhaustedError(message) {
  return CREDIT_EXHAUSTED_PATTERNS.some(rx => rx.test(message || ''));
}

// ─────────────────────────────────────────────────────────────────────────
// DeepSeek fallback call
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';

// Models that spend completion tokens on chain-of-thought. Measured on
// deepseek-v4-pro: 1175-3768 reasoning tokens to emit ~84 tokens of JSON, which is
// 93-98% of completion and 20-59s of wall clock on an agent-facing panel.
//
// reasoning_effort was already 'low' on every call and made no difference, so the
// only real lever is the model. `reasoning_effort` is only sent when the chosen
// model is one of these — a non-reasoning model may reject the parameter outright.
const REASONING_MODEL_RE = /(?:-pro\b|reasoner|-r1\b|thinking)/i;

const DEFAULT_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 60000;

// A per-request model hint that the account cannot serve would 400 on every call,
// return null, and route every request to Haiku — which looks like a DeepSeek
// outage but is a config typo. So: on a model-not-found, retry ONCE with the
// env/default model and remember the bad name, so DeepSeek stays primary and the
// wasted round-trip is paid once rather than forever.
const MODEL_NOT_FOUND_RE = /model\s*(?:not\s*(?:exist|found)|does\s*not\s*exist|unavailable|invalid)|invalid[_\s]model|unknown\s*model|no\s*such\s*model/i;
// Same problem, different field: an unsupported reasoning_effort value would 400
// every call and route everything to Haiku. Retry once without the parameter.
const BAD_EFFORT_RE = /reasoning[_\s]effort/i;
const badModels = new Set();
const badEfforts = new Set();

/**
 * @param {string} anthropicRequestBodyStr  an Anthropic-shaped request body.
 *   Recognised non-Anthropic hints, all optional:
 *     deepseekModel            per-request model override, beats DEEPSEEK_MODEL env
 *     deepseekReasoningEffort  'minimal' | 'low' | 'medium' | 'high'
 *     deepseekTimeoutMs        per-request timeout
 *     _reasoningEffort         legacy alias, still honoured
 */
async function tryDeepSeekFallback(anthropicRequestBodyStr) {
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  try {
    const deepseekKey = await getProviderKey('deepseek', 'DEEPSEEK_API_KEY');
    if (!deepseekKey) {
      console.warn('[AI] No DeepSeek key configured — cannot fall back');
      return null;
    }

    const parsed = JSON.parse(anthropicRequestBodyStr);

    const hasImages = (parsed.messages || []).some(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === 'image')
    );
    if (hasImages) {
      console.warn('[AI] Request contains image content — DeepSeek fallback not attempted');
      return null;
    }

    const flatten = (content) => {
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      }
      return '';
    };

    const deepseekMessages = [];
    if (parsed.system) deepseekMessages.push({ role: 'system', content: parsed.system });
    (parsed.messages || []).forEach(m => {
      deepseekMessages.push({ role: m.role, content: flatten(m.content) });
    });

    // Per-request beats env beats default. The per-request hint is what lets fast
    // mode use a non-reasoning model while detailed mode keeps the reasoning one,
    // with DeepSeek staying primary for both.
    const hinted = parsed.deepseekModel && !badModels.has(parsed.deepseekModel)
      ? parsed.deepseekModel
      : null;
    if (parsed.deepseekModel && !hinted) {
      console.warn(`[AI] Skipping known-bad DeepSeek model "${parsed.deepseekModel}" — using env/default. Restart clears this.`);
    }
    const model = hinted || process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
    const isReasoning = REASONING_MODEL_RE.test(model);
    const effort = parsed.deepseekReasoningEffort || parsed._reasoningEffort || 'low';
    timeoutMs = Number(parsed.deepseekTimeoutMs) || DEFAULT_TIMEOUT_MS;

    const payload = {
      model,
      max_tokens: Math.min(parsed.max_tokens || 2000, 8192),
      temperature: parsed.temperature ?? 1.0,
      messages: deepseekMessages,
      ...(isReasoning && !badEfforts.has(effort) && { reasoning_effort: effort }),
    };

    const call = async (body) => {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { r, txt: await r.text() };
    };

    const started = Date.now();
    let { r: res, txt: text } = await call(payload);

    // Model-not-found on a hinted model: fall back to env/default rather than to
    // Haiku. Keeps DeepSeek primary through a bad model name.
    if (!res.ok && parsed.deepseekModel && MODEL_NOT_FOUND_RE.test(text)) {
      const alt = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
      badModels.add(payload.model);
      console.error(`[AI] DeepSeek rejected model "${payload.model}" (${res.status}). Retrying once with "${alt}" so DeepSeek stays primary. Fix DEEPSEEK_SUGGEST_MODEL — check GET https://api.deepseek.com/models for valid names.`);
      if (alt !== payload.model) {
        payload.model = alt;
        const altIsReasoning = REASONING_MODEL_RE.test(alt);
        if (altIsReasoning) payload.reasoning_effort = effort;
        else delete payload.reasoning_effort;
        ({ r: res, txt: text } = await call(payload));
      }
    }

    if (!res.ok && 'reasoning_effort' in payload && BAD_EFFORT_RE.test(text)) {
      badEfforts.add(effort);
      console.error(`[AI] DeepSeek rejected reasoning_effort "${effort}" (${res.status}). Retrying once without it so DeepSeek stays primary.`);
      delete payload.reasoning_effort;
      ({ r: res, txt: text } = await call(payload));
    }

    if (!res.ok) {
      console.error(`[AI] DeepSeek fallback failed: ${res.status} ${text.slice(0, 300)}`);
      return null;
    }

    const data = JSON.parse(text);
    const choice = data.choices?.[0] || {};
    const finish = choice.finish_reason ?? '?';
    const u = data.usage || {};
    const reasoningTokens = u.completion_tokens_details?.reasoning_tokens
      ?? u.reasoning_tokens
      ?? null;
    console.log(`[AI] DeepSeek model=${data.model || model} reasoning=${isReasoning ? effort : 'off'} tokens=${u.total_tokens ?? '?'} completion=${u.completion_tokens ?? '?'}${reasoningTokens != null ? ` (reasoning=${reasoningTokens})` : ''} finish=${finish} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    const content = choice.message?.content || '';

    // reasoning_content is chain-of-thought, not an answer. Using it as the reply
    // hands abandoned intermediate JSON to parseAIResponse, which takes the LAST
    // balanced block it finds — so a rejected draft can win over the real one.
    // Still used as a last resort because an empty content with a full reasoning
    // field is better than nothing, but it is now loud instead of silent.
    const reasoningOnly = !content && choice.message?.reasoning_content;
    if (reasoningOnly) {
      console.warn(`[AI] DeepSeek returned EMPTY content with reasoning_content present (finish=${finish}). Falling back to chain-of-thought text — parsed JSON may come from an abandoned draft. If this recurs, lower reasoning effort or raise max_tokens.`);
    }
    const body = content || choice.message?.reasoning_content || '';

    if (!body) {
      console.error(`[AI] DeepSeek returned no content (finish=${finish}). Body: ${text.slice(0, 500)}`);
      return null;
    }

    console.log('[AI] DeepSeek fallback succeeded');
    const stopReasonMap = { stop: 'end_turn', length: 'max_tokens', content_filter: 'end_turn', tool_calls: 'tool_use' };

    return {
      content: [{ type: 'text', text: body }],
      stop_reason: stopReasonMap[finish] || finish,
      _fallbackProvider: 'deepseek',
      _deepseekModel: data.model || model,
      _reasoningUsed: isReasoning,
    };
  } catch (err) {
    const label = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? `timeout (${timeoutMs / 1000}s)`
      : err.message;
    console.error('[AI] DeepSeek fallback error:', label);
    return null;
  }
}

module.exports = {
  ensureProviderKeysTable,
  getProviderKey,
  saveProviderKey,
  deleteProviderKey,
  maskKey,
  isCreditExhaustedError,
  tryDeepSeekFallback,
  DEFAULT_DEEPSEEK_MODEL,
  REASONING_MODEL_RE,
  MODEL_NOT_FOUND_RE,
};