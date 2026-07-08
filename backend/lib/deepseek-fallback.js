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

async function tryDeepSeekFallback(anthropicRequestBodyStr) {
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

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
        max_tokens: Math.min(parsed.max_tokens || 2000, 8192),
        temperature: parsed.temperature ?? 1.0,
        messages: deepseekMessages,
      }),
      signal: AbortSignal.timeout(28000),  // fail fast into Claude — was 60000
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[AI] DeepSeek fallback failed: ${res.status} ${text.slice(0, 300)}`);
      return null;
    }

    const data = JSON.parse(text);
    const choice = data.choices?.[0] || {};
    const finish = choice.finish_reason ?? '?';
    console.log(`[AI] DeepSeek model=${data.model || 'unknown'} tokens=${data.usage?.total_tokens ?? '?'} completion=${data.usage?.completion_tokens ?? '?'} finish=${finish}`);

    // v4-pro may be reasoning-style: real answer can land in reasoning_content
    // when `content` is empty. Prefer content, fall back to reasoning_content.
    const content = choice.message?.content
      || choice.message?.reasoning_content
      || '';

    if (!content) {
      // Log the actual body so the empty-response cause is visible, not guessed.
      console.error(`[AI] DeepSeek returned no content (finish=${finish}). Body: ${text.slice(0, 500)}`);
      return null;
    }

    console.log('[AI] DeepSeek fallback succeeded');

    return {
      content: [{ type: 'text', text: content }],
      _fallbackProvider: 'deepseek',
    };
  } catch (err) {
    // AbortSignal.timeout throws a TimeoutError/AbortError — name it clearly.
    const label = err.name === 'TimeoutError' || err.name === 'AbortError' ? 'timeout (12s)' : err.message;
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
};