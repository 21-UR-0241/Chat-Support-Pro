// CrossStoreHistory.jsx
// Drop next to ChatWindow.jsx
// Agent/admin only — never exposed to the customer widget

import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';

// ── Store color palette ────────────────────────────────────────────────────
const STORE_COLORS = [
  '#00a884', '#7c3aed', '#db2777', '#ea580c', '#0891b2',
  '#059669', '#d97706', '#dc2626', '#2563eb', '#9333ea',
];

const getStoreColor = (storeIdentifier) => {
  if (!storeIdentifier) return STORE_COLORS[0];
  let hash = 0;
  for (let i = 0; i < storeIdentifier.length; i++) {
    hash = storeIdentifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STORE_COLORS[Math.abs(hash) % STORE_COLORS.length];
};

const getStoreInitial = (storeName) => {
  if (!storeName) return '?';
  return storeName.charAt(0).toUpperCase();
};

const truncate = (str, n) => {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
};

// ── Single store group ─────────────────────────────────────────────────────
function StoreGroup({ group, isExpanded, onToggle, onOpenConversation }) {
  const color = getStoreColor(group.storeIdentifier);
  const latestConv = group.conversations[0];

  return (
    <div style={{
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid #e9edef',
      marginBottom: '8px',
      background: '#fff',
    }}>
      {/* Store header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px',
          background: isExpanded ? '#f9fafb' : '#fff',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#f5f6f6'; }}
        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '#fff'; }}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '14px', flexShrink: 0,
        }}>
          {getStoreInitial(group.storeName)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111b21', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {truncate(group.storeName, 28)}
            <span style={{
              fontSize: '10px', fontWeight: 600,
              background: color + '18', color,
              padding: '1px 6px', borderRadius: '10px',
            }}>
              {group.conversations.length} conv{group.conversations.length !== 1 ? 's' : ''}
            </span>
          </div>
          {!isExpanded && latestConv?.lastMessage && (
            <div style={{ fontSize: '11px', color: '#667781', marginTop: '1px' }}>
              {latestConv.lastMessage.senderType === 'agent' ? 'You: ' : ''}
              {truncate(latestConv.lastMessage.content || '📎 File', 40)}
            </div>
          )}
        </div>

        <span style={{
          fontSize: '11px', color: '#aab8c2',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', flexShrink: 0,
        }}>▼</span>
      </button>

      {/* Conversation list */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #f0f2f5' }}>
          {group.conversations.map((conv, i) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onOpenConversation && onOpenConversation(conv.id, group.storeIdentifier)}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '9px 12px 9px 14px',
                background: 'transparent', border: 'none',
                borderTop: i > 0 ? '1px solid #f5f6f6' : 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f6f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: conv.status === 'active' ? '#00a884' : '#d1d5db',
                marginTop: '5px', flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#3b4a54' }}>
                    Conv #{conv.id}
                  </span>
                  <span style={{ fontSize: '10px', color: '#aab8c2', flexShrink: 0 }}>
                    {conv.updatedAt
                      ? formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })
                      : '—'}
                  </span>
                </div>

                {conv.lastMessage ? (
                  <div style={{ fontSize: '11px', color: '#667781', marginTop: '2px' }}>
                    {conv.lastMessage.senderType === 'agent'
                      ? <span style={{ color: '#00a884', fontWeight: 500 }}>You: </span>
                      : null}
                    {truncate(conv.lastMessage.content || '📎 File', 52)}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#c4cdd5', fontStyle: 'italic' }}>No messages</div>
                )}
              </div>

              <span style={{
                fontSize: '9px', fontWeight: 700,
                padding: '2px 6px', borderRadius: '6px',
                background: conv.status === 'active' ? '#dcfce7' : '#f3f4f6',
                color: conv.status === 'active' ? '#16a34a' : '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.4px',
                flexShrink: 0, marginTop: '2px',
              }}>
                {conv.status || 'closed'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ count, storeCount, loading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      paddingBottom: '10px',
      borderBottom: '1px solid #f0f2f5',
      marginBottom: '10px',
    }}>
      <span style={{ fontSize: '14px' }}>🏪</span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b4a54', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Cross-Store History
      </span>
      {loading ? (
        <div style={{
          width: '12px', height: '12px',
          border: '2px solid #e9edef', borderTopColor: '#00a884',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          marginLeft: '4px',
        }} />
      ) : count > 0 ? (
        <span style={{
          marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
          background: '#00a88418', color: '#00a884',
          padding: '2px 7px', borderRadius: '10px',
        }}>
          {count} conv{count !== 1 ? 's' : ''} · {storeCount} store{storeCount !== 1 ? 's' : ''}
        </span>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CrossStoreHistory({
  customerEmail,
  currentConversationId,
  currentStoreIdentifier,
  onOpenConversation,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedStores, setExpandedStores] = useState(new Set());

  const load = useCallback(async () => {
    if (!customerEmail) return;
    try {
      setLoading(true);
      setError(null);
      const result = await api.getLinkedConversations(customerEmail, currentConversationId);
      setData(result);
      if (result.linkedConversations?.length === 1) {
        setExpandedStores(new Set([result.linkedConversations[0].storeIdentifier]));
      }
    } catch (err) {
      console.error('❌ [CrossStoreHistory] Failed to load:', err);
      setError('Could not load history');
    } finally {
      setLoading(false);
    }
  }, [customerEmail, currentConversationId]);

  useEffect(() => { load(); }, [load]);

  const toggleStore = (storeIdentifier) => {
    setExpandedStores(prev => {
      const next = new Set(prev);
      if (next.has(storeIdentifier)) next.delete(storeIdentifier);
      else next.add(storeIdentifier);
      return next;
    });
  };

  if (!customerEmail) return null;

  if (loading) {
    return (
      <div style={{ padding: '14px 14px 6px', borderTop: '1px solid #e9edef', background: '#fafbfc' }}>
        <SectionHeader loading />
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ width: '18px', height: '18px', border: '2.5px solid #e9edef', borderTopColor: '#00a884', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '14px 14px 6px', borderTop: '1px solid #e9edef', background: '#fafbfc' }}>
        <SectionHeader count={0} />
        <div style={{ padding: '12px 16px', fontSize: '12px', color: '#fc8181' }}>
          ⚠️ {error}
          <button type="button" onClick={load} style={{ marginLeft: '8px', color: '#00a884', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.storeCount === 0) {
    return (
      <div style={{ padding: '14px 14px 6px', borderTop: '1px solid #e9edef', background: '#fafbfc' }}>
        <SectionHeader count={0} />
        <div style={{ padding: '12px 16px', fontSize: '12px', color: '#aab8c2', fontStyle: 'italic' }}>
          No other store conversations found.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 14px 6px', borderTop: '1px solid #e9edef', background: '#fafbfc' }}>
      <SectionHeader count={data.totalConversations} storeCount={data.storeCount} />

      {/* Store pill summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingBottom: '10px' }}>
        {data.linkedConversations.map(group => (
          <div
            key={group.storeIdentifier}
            title={group.storeName}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 8px', borderRadius: '12px',
              background: getStoreColor(group.storeIdentifier) + '18',
              border: `1px solid ${getStoreColor(group.storeIdentifier)}40`,
              fontSize: '11px', fontWeight: 600,
              color: getStoreColor(group.storeIdentifier),
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStoreColor(group.storeIdentifier) }} />
            {truncate(group.storeName, 20)}
          </div>
        ))}
      </div>

      {/* Store groups */}
      <div>
        {data.linkedConversations.map(group => (
          <StoreGroup
            key={group.storeIdentifier}
            group={group}
            isExpanded={expandedStores.has(group.storeIdentifier)}
            onToggle={() => toggleStore(group.storeIdentifier)}
            onOpenConversation={onOpenConversation}
          />
        ))}
      </div>
    </div>
  );
}