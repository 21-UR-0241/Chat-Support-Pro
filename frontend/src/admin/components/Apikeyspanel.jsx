import React, { useState, useEffect, useCallback } from 'react';

// If you already have a shared API_BASE / apiFetch (e.g. exported from
// AITraining.jsx or a utils file), import that instead of duplicating it here.
const API_BASE = (import.meta.env.PROD
  ? import.meta.env.VITE_API_URL || 'https://chat-support-pro.onrender.com'
  : '') + '/api';

function getToken() { return localStorage.getItem('token') || ''; }

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

const PROVIDER_META = {
  deepseek: {
    label: 'DeepSeek',
    icon: '🔁',
    color: '#60a5fa',
    helpUrl: 'https://platform.deepseek.com/api_keys',
    description: 'Used automatically as a fallback whenever the Anthropic API is rate-limited or out of credit.',
  },
};

export default function ApiKeysPanel() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [drafts, setDrafts]       = useState({});
  const [saving, setSaving]       = useState({});
  const [toast, setToast]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/ai/settings/keys');
      setProviders(data.providers || []);
    } catch (e) {
      setToast(`❌ Failed to load: ${e.message}`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (provider) => {
    const apiKey = (drafts[provider] || '').trim();
    if (!apiKey) return;
    setSaving(prev => ({ ...prev, [provider]: true }));
    try {
      await apiFetch('/ai/settings/keys', { method: 'POST', body: JSON.stringify({ provider, apiKey }) });
      setDrafts(prev => ({ ...prev, [provider]: '' }));
      setToast(`✅ ${PROVIDER_META[provider]?.label || provider} key saved`);
      await load();
    } catch (e) {
      setToast(`❌ Save failed: ${e.message}`);
    } finally { setSaving(prev => ({ ...prev, [provider]: false })); }
  };

  const remove = async (provider) => {
    if (!window.confirm(`Remove the saved ${PROVIDER_META[provider]?.label || provider} key? This reverts to the environment variable, if one exists.`)) return;
    try {
      await apiFetch(`/ai/settings/keys/${provider}`, { method: 'DELETE' });
      setToast(`🗑️ ${PROVIDER_META[provider]?.label || provider} key removed`);
      await load();
    } catch (e) {
      setToast(`❌ Remove failed: ${e.message}`);
    }
  };

  const rows = Object.keys(PROVIDER_META).map(provider => ({
    provider,
    meta: PROVIDER_META[provider],
    info: providers.find(p => p.provider === provider),
  }));

  return (
    <div style={{ padding: '28px', maxWidth: 620, margin: '0 auto', fontFamily: "'DM Sans', sans-serif", color: '#e2e8f0' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Fallback API Keys</h4>
      <p style={{ margin: '0 0 24px', fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
        When Claude hits a rate limit or the Anthropic account runs out of credit, the backend
        automatically retries the same request against the provider below instead of failing.
      </p>

      {loading && <p style={{ color: '#475569', fontSize: 13 }}>Loading…</p>}

      {!loading && rows.map(({ provider, meta, info }) => (
        <div key={provider} style={{
          background: '#0d1117', border: `1px solid ${meta.color}25`, borderLeft: `3px solid ${meta.color}`,
          borderRadius: 10, padding: '16px 18px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>{meta.icon}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>{meta.label}</span>
            {info?.configured ? (
              <span style={{ fontSize: 10, color: '#34d399', background: '#34d39915', border: '1px solid #34d39930', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
                ● active · {info.source === 'database' ? 'saved key' : 'env variable'}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#f87171', background: '#f8717112', border: '1px solid #f8717125', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
                not configured
              </span>
            )}
          </div>

          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#475569', lineHeight: 1.5 }}>{meta.description}</p>

          {info?.maskedKey && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
              Current key: {info.maskedKey}
              {info.updatedBy ? <span style={{ color: '#334155' }}> · saved by {info.updatedBy}</span> : null}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={drafts[provider] || ''}
              onChange={e => setDrafts(prev => ({ ...prev, [provider]: e.target.value }))}
              placeholder={`Paste ${meta.label} API key…`}
              style={{ flex: 1, background: '#080b14', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 12px', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={() => save(provider)}
              disabled={!drafts[provider]?.trim() || saving[provider]}
              style={{
                background: meta.color, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700,
                padding: '8px 16px', fontSize: 12, cursor: 'pointer',
                opacity: (!drafts[provider]?.trim() || saving[provider]) ? 0.4 : 1,
              }}
            >{saving[provider] ? 'Saving…' : 'Save'}</button>
            {info?.source === 'database' && (
              <button onClick={() => remove(provider)} style={{ background: 'transparent', border: '1px solid #f8717130', color: '#f87171', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
                Remove
              </button>
            )}
          </div>

          <a href={meta.helpUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#475569' }}>
            Get a {meta.label} API key →
          </a>
        </div>
      ))}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.startsWith('❌') ? '#7f1d1d' : '#166534', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}