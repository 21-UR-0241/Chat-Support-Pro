import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// ─── tiny helpers ────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
};

const fmtFull = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const initials = (name) => {
  if (!name) return 'G';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const avatarHue = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 37) % 360;
  return h;
};

/**
 * Resolves the store name by looking up the conversation's shop ID
 * in the loaded stores list first, then falling back to inline fields.
 */
const resolveStoreLabel = (conv, stores = []) => {
  // 1. Match against the loaded stores list by every possible ID field
  const convStoreId =
    conv.shopId || conv.shop_id ||
    conv.storeId || conv.store_id ||
    conv.storeIdentifier || conv.store_identifier;

  if (convStoreId && stores.length) {
    const match = stores.find(s =>
      String(s.id)              === String(convStoreId) ||
      String(s.shopId)          === String(convStoreId) ||
      String(s.shop_id)         === String(convStoreId) ||
      String(s.storeId)         === String(convStoreId) ||
      String(s.identifier)      === String(convStoreId) ||
      String(s.shopDomain)      === String(convStoreId) ||
      String(s.shop_domain)     === String(convStoreId) ||
      String(s.myshopifyDomain) === String(convStoreId)
    );
    if (match) {
      return (
        match.name        ||
        match.storeName   ||
        match.store_name  ||
        match.brandName   ||
        match.shopName    ||
        match.shop_name   ||
        match.shopDomain  ||
        match.shop_domain ||
        match.identifier  ||
        null
      );
    }
  }

  // 2. Fall back to inline fields on the conversation object itself
  const inline = [
    conv.brandName, conv.brand_name,
    conv.storeName, conv.store_name,
    conv.shopName,  conv.shop_name,
    conv.store?.name, conv.shop?.name,
  ];
  return inline.find(v => v && String(v).trim() !== '') || null;
};

// ─── UnarchiveModal ───────────────────────────────────────────────────────────
function UnarchiveModal({ conv, onConfirm, onClose, loading }) {
  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={{ ...MODAL_CARD, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ ...MODAL_HEADER, background: '#6366f1' }}>
          <span style={{ fontSize: 22 }}>📬</span>
          <div>
            <div style={MODAL_TITLE}>Restore Conversation</div>
            <div style={MODAL_SUBTITLE}>{conv.customerName || 'Guest'}</div>
          </div>
          <button type="button" onClick={onClose} style={MODAL_CLOSE_BTN}>✕</button>
        </div>
        <div style={{ padding: '22px 20px 20px' }}>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#3b4a54', lineHeight: 1.6 }}>
            This conversation will be moved back to your <strong>active inbox</strong> with status <strong>Open</strong>.
          </p>
          <div style={{ background: '#f0f0ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#3730a3', marginBottom: 18 }}>
            ℹ️ All messages and history are preserved exactly as they were.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} disabled={loading} style={BTN_CANCEL}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={loading} style={{ ...BTN_PRIMARY, background: loading ? 'rgba(99,102,241,0.45)' : '#6366f1' }}>
              {loading ? '⏳ Restoring…' : '📬 Restore to Inbox'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ConvCard ─────────────────────────────────────────────────────────────────
function ConvCard({ conv, onRestore, stores }) {
  const [hovered, setHovered] = useState(false);
  const hue = avatarHue(conv.customerName);
  const storeLabel = resolveStoreLabel(conv, stores);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${hovered ? '#c7d2fe' : '#e9edef'}`,
        padding: '15px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 16px rgba(99,102,241,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: `hsl(${hue},55%,55%)`,
        color: '#fff', fontWeight: 700, fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, letterSpacing: '0.5px',
      }}>
        {initials(conv.customerName)}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.customerName || 'Guest'}
          </span>
          {conv.legalFlag && (
            <span title="Legal flag" style={{ fontSize: 13 }}>
              {conv.legalFlagSeverity === 'critical' ? '🚨' : '⚠️'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
          {conv.customerEmail || 'No email'}
          {storeLabel && (
            <>
              {' · '}
              <strong style={{ color: '#3b4a54' }}>{storeLabel}</strong>
            </>
          )}
          {!storeLabel && (
            <>
              {' · '}
              <span style={{ color: '#aab8c2', fontStyle: 'italic' }}>No store info</span>
            </>
          )}
        </div>
        {conv.lastMessage && (
          <div style={{ fontSize: 12, color: '#aab8c2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.lastMessage.substring(0, 90)}
          </div>
        )}
      </div>

      {/* Right side */}
      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ fontSize: 11, color: '#aab8c2', whiteSpace: 'nowrap' }}>
          Archived {fmtDate(conv.archivedAt || conv.archived_at)}
        </div>
        <div style={{ fontSize: 11, color: '#c7d2fe', whiteSpace: 'nowrap' }}>
          {fmtFull(conv.archivedAt || conv.archived_at)}
        </div>
        <button
          type="button"
          onClick={() => onRestore(conv)}
          style={{
            background: hovered ? '#6366f1' : '#f0f0ff',
            color: hovered ? '#fff' : '#6366f1',
            border: '1.5px solid #6366f1',
            borderRadius: 7, padding: '5px 13px',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          📬 Restore
        </button>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ArchivedConversations({ onBack, onUnarchive, stores = [] }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [pagination, setPagination]       = useState(null);
  const [search, setSearch]               = useState('');
  const [storeFilter, setStoreFilter]     = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring]         = useState(false);
  const [toast, setToast]                 = useState(null);
  const toastRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, type });
    toastRef.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current); }, []);

  const load = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      const data = await api.getArchivedConversations({ page: p, limit: 25, storeIdentifier: storeFilter || undefined });
      setConversations(data.conversations || []);
      setPagination(data.pagination || null);
      setPage(p);
    } catch (err) {
      console.error('Failed to load archived conversations:', err);
      showToast(`⚠️ Failed to load: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [storeFilter]);

  useEffect(() => { load(1); }, [load]);

  const filtered = search.trim()
    ? conversations.filter(c => {
        const storeLabel = resolveStoreLabel(c, stores) || '';
        return [c.customerName, c.customerEmail, storeLabel]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      })
    : conversations;

  const handleRestore = (conv) => setRestoreTarget(conv);

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      await api.unarchiveConversation(restoreTarget.id);
      setConversations(prev => prev.filter(c => c.id !== restoreTarget.id));
      if (pagination) setPagination(p => ({ ...p, total: Math.max(0, p.total - 1) }));
      showToast(`✅ ${restoreTarget.customerName || 'Conversation'} restored to inbox`);
      if (onUnarchive) onUnarchive(restoreTarget);
    } catch (err) {
      showToast(`⚠️ Restore failed: ${err.message}`, 'error');
    } finally {
      setRestoring(false);
      setRestoreTarget(null);
    }
  };

  const totalArchived = pagination?.total ?? conversations.length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f0f2f5', overflow: 'hidden' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: toast.type === 'error' ? '#e53e3e' : '#111b21',
          color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 22px',
          borderRadius: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          pointerEvents: 'none', animation: 'archiveToastIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Unarchive confirm modal */}
      {restoreTarget && (
        <UnarchiveModal
          conv={restoreTarget}
          onConfirm={handleConfirmRestore}
          onClose={() => setRestoreTarget(null)}
          loading={restoring}
        />
      )}

      {/* ── Header ── */}
      <div style={{
        background: '#fff', flexShrink: 0,
        borderBottom: '1px solid #e9edef',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}>
        {/* Top bar */}
        <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" onClick={onBack} style={BACK_BTN}>← Back</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>📦</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#111b21', lineHeight: 1.2 }}>
                Archived Conversations
              </div>
              <div style={{ fontSize: 12, color: '#667781' }}>
                {loading ? 'Loading…' : `${totalArchived} conversation${totalArchived !== 1 ? 's' : ''} archived`}
              </div>
            </div>
          </div>

          <button type="button" onClick={() => load(1)} style={REFRESH_BTN('#6366f1')}>
            🔄 Refresh
          </button>
        </div>

        {/* Search + filter bar */}
        <div style={{ padding: '0 24px 14px', display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aab8c2', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Search name, email, store…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...SEARCH_INPUT, paddingLeft: 34 }}
            />
          </div>
          <input
            type="text"
            placeholder="Filter by store identifier…"
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(1); }}
            style={{ ...SEARCH_INPUT, width: 230 }}
          />
          {storeFilter && (
            <button type="button" onClick={() => setStoreFilter('')} style={{ ...BACK_BTN, borderColor: '#e9edef' }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={EMPTY_STATE}>
            <div className="spinner" style={{ margin: '0 auto 14px', width: 32, height: 32 }} />
            <div style={{ fontSize: 14, color: '#667781' }}>Loading archived conversations…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={EMPTY_STATE}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>📭</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111b21', marginBottom: 6 }}>
              {search ? 'No matches found' : 'Nothing archived yet'}
            </div>
            <div style={{ fontSize: 13, color: '#667781' }}>
              {search
                ? 'Try a different search term or clear the filter.'
                : 'Conversations you archive from the chat window will appear here.'}
            </div>
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ ...BTN_PRIMARY, marginTop: 16, background: '#6366f1' }}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Stats row */}
            {pagination && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 18, maxWidth: 860, margin: '0 auto 18px' }}>
                {[
                  { label: 'Total archived', value: pagination.total, color: '#6366f1' },
                  { label: 'This page', value: filtered.length, color: '#667781' },
                  { label: 'Page', value: `${page} / ${pagination.pages}`, color: '#667781' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#fff', borderRadius: 10, padding: '10px 16px',
                    border: '1px solid #e9edef', flex: 1, textAlign: 'center',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#aab8c2', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860, margin: '0 auto' }}>
              {filtered.map(conv => (
                <ConvCard key={conv.id} conv={conv} onRestore={handleRestore} stores={stores} />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 }}>
                <button type="button" disabled={page <= 1} onClick={() => load(page - 1)} style={PAGE_BTN(page <= 1)}>
                  ← Prev
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button key={p} type="button" onClick={() => load(p)} style={{
                        width: 34, height: 34, borderRadius: 7,
                        border: `1px solid ${p === page ? '#6366f1' : '#e9edef'}`,
                        background: p === page ? '#6366f1' : '#fff',
                        color: p === page ? '#fff' : '#3b4a54',
                        fontWeight: p === page ? 700 : 400,
                        cursor: 'pointer', fontSize: 13,
                      }}>{p}</button>
                    );
                  })}
                </div>
                <button type="button" disabled={page >= pagination.pages} onClick={() => load(page + 1)} style={PAGE_BTN(page >= pagination.pages)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes archiveToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Shared style tokens ──────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 10001,
  background: 'rgba(11,20,26,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const MODAL_CARD = {
  background: '#fff', borderRadius: 14,
  width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  overflow: 'hidden', animation: 'modalIn 0.2s ease',
};
const MODAL_HEADER = {
  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
};
const MODAL_TITLE  = { color: '#fff', fontWeight: 700, fontSize: 15 };
const MODAL_SUBTITLE = { color: 'rgba(255,255,255,0.82)', fontSize: 12 };
const MODAL_CLOSE_BTN = {
  marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none',
  borderRadius: '50%', width: 30, height: 30,
  cursor: 'pointer', color: '#fff', fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const BTN_CANCEL = {
  background: '#f0f2f5', border: '1px solid #e9edef',
  borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500,
  cursor: 'pointer', color: '#3b4a54',
};
const BTN_PRIMARY = {
  border: 'none', borderRadius: 8, padding: '10px 22px',
  fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
  display: 'flex', alignItems: 'center', gap: 6,
};
const BACK_BTN = {
  background: '#f0f2f5', border: '1px solid #e9edef', borderRadius: 8,
  padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#3b4a54', fontWeight: 500,
};
const REFRESH_BTN = (color) => ({
  background: color, color: '#fff', border: 'none',
  borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
});
const SEARCH_INPUT = {
  padding: '9px 12px', border: '1.5px solid #e9edef', borderRadius: 20,
  fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111b21',
  boxSizing: 'border-box', width: '100%',
};
const EMPTY_STATE = {
  textAlign: 'center', padding: '80px 20px', color: '#667781',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
};
const PAGE_BTN = (disabled) => ({
  background: disabled ? '#f0f2f5' : '#fff',
  border: '1px solid #e9edef', borderRadius: 8,
  padding: '8px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, color: '#3b4a54', opacity: disabled ? 0.5 : 1,
});