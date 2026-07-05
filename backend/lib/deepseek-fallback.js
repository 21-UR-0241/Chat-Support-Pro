// backend/lib/deepseek-fallback.js
//
// Provider-key storage (DB-backed, env-var fallback) + DeepSeek fallback
// for when the Anthropic API is rate-limited or the account is out of credit.
//
// Drop this file in backend/lib/. If your `database.js` lives somewhere
// other than one level up from this file, adjust the require path below.

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

// envFallbackVar lets you keep using an env var (e.g. DEEPSEEK_API_KEY) until
// an admin saves one via the UI — the DB value always wins once it exists.
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
//
// Converts an Anthropic-shaped request (system + messages, possibly with
// image blocks) into DeepSeek's OpenAI-compatible chat/completions format,
// then wraps the reply back into Anthropic's response shape:
//   { content: [{ type: 'text', text: '...' }] }
// so every existing call site (`response.content?.[0]?.text`) keeps working
// completely unchanged.
// ─────────────────────────────────────────────────────────────────────────

async function tryDeepSeekFallback(anthropicRequestBodyStr) {
  try {
    const deepseekKey = await getProviderKey('deepseek', 'DEEPSEEK_API_KEY');
    if (!deepseekKey) {
      console.warn('[AI] No DeepSeek key configured — cannot fall back');
      return null;
    }

    const parsed = JSON.parse(anthropicRequestBodyStr);

    // DeepSeek's standard chat API is text-only as far as this integration
    // assumes — bail out rather than silently dropping image content.
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
        model: 'deepseek-chat',
        max_tokens: parsed.max_tokens || 2000,
        messages: deepseekMessages,
      }),
      signal: AbortSignal.timeout(60000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[AI] DeepSeek fallback failed: ${res.status} ${text.slice(0, 200)}`);
      return null;
    }

    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) {
      console.error('[AI] DeepSeek fallback returned no content');
      return null;
    }

    console.log('[AI] DeepSeek fallback succeeded');

    return {
      content: [{ type: 'text', text: content }],
      _fallbackProvider: 'deepseek',
    };
  } catch (err) {
    console.error('[AI] DeepSeek fallback error:', err.message);
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