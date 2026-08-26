import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import '../styles/OrderPanel.css';

/**
 * Shopify orders for the customer in this conversation.
 *
 * Agent-facing only. The AI writes suggestions from the brain data and the
 * transcript; what is shown here is for the human to read and decide about, so
 * the guards against invented tracking numbers and dates stay meaningful.
 *
 * Loads on demand rather than on mount: most conversations are not order
 * questions, and every lookup is a Shopify API call against a rate limit.
 */
function OrderPanel({ conversation }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [copied, setCopied] = useState(null);
  const requestedFor = useRef(null);

  const email = conversation?.customerEmail || conversation?.customer_email || null;
  const storeId = conversation?.storeIdentifier || conversation?.store_identifier
    || conversation?.shopId || conversation?.shop_id || null;

  // Switching conversation must not leave the previous customer's orders on
  // screen — that is someone else's data under a new name.
  useEffect(() => {
    setState({ status: 'idle', data: null, error: null });
    setCopied(null);
    requestedFor.current = null;
  }, [conversation?.id]);

  const load = async () => {
    if (!email || !storeId) return;
    const key = `${conversation?.id}`;
    requestedFor.current = key;
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await api.getOrders(storeId, email);
      if (requestedFor.current !== key) return;   // switched mid-request
      setState({ status: 'done', data, error: null });
    } catch (err) {
      if (requestedFor.current !== key) return;
      setState({ status: 'error', data: null, error: err.message });
    }
  };

  const copy = async (value, id) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard is blocked in some contexts; the value is selectable on screen.
    }
  };

  if (!email) {
    return (
      <div className="order-panel">
        <div className="order-panel-header">Orders</div>
        <p className="order-panel-empty">No customer email on this conversation, so there is nothing to look up.</p>
      </div>
    );
  }

  return (
    <div className="order-panel">
      <div className="order-panel-header">
        <span>Orders</span>
        <button
          type="button"
          className="order-panel-load"
          onClick={load}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? 'Looking up…' : state.status === 'done' ? 'Refresh' : 'Look up'}
        </button>
      </div>

      {state.status === 'idle' && (
        <p className="order-panel-empty">Look up {email}&apos;s recent orders.</p>
      )}

      {state.status === 'error' && (
        <p className="order-panel-error">{state.error}</p>
      )}

      {state.status === 'done' && !state.data?.connected && (
        <p className="order-panel-empty">
          {state.data?.reason || 'This store is not connected to Shopify yet.'}
        </p>
      )}

      {state.status === 'done' && state.data?.connected && !state.data?.customerFound && (
        <p className="order-panel-empty">No Shopify customer found for {email}.</p>
      )}

      {state.status === 'done' && state.data?.connected && state.data?.customerFound && (
        state.data.orders.length === 0 ? (
          <p className="order-panel-empty">This customer has no orders yet.</p>
        ) : (
          <ul className="order-list">
            {state.data.orders.map((o) => (
              <li key={o.id} className="order-card">
                <div className="order-card-top">
                  <span className="order-number">{o.orderNumber}</span>
                  <span className={`order-status order-status--${o.status.replace(/[^a-z]+/g, '-')}`}>
                    {o.status}
                  </span>
                </div>

                <div className="order-meta">
                  {o.placedAt && <span>{new Date(o.placedAt).toLocaleDateString()}</span>}
                  {o.total && <span>{o.total} {o.currency || ''}</span>}
                  {o.items.length > 0 && (
                    <span className="order-items">
                      {o.items.map((i) => `${i.quantity}× ${i.title}`).join(', ')}
                    </span>
                  )}
                </div>

                {/* Shopify knows a label was created; it cannot know the carrier
                    physically took the parcel. Flagged for the agent to verify,
                    never stated to the customer as fact. */}
                {o.awaitingCarrierScan && (
                  <p className="order-warn">Label created, no carrier scan reported yet — worth verifying before promising movement.</p>
                )}

                {o.tracking.map((t) => (
                  <div key={t.number} className="order-tracking">
                    <span className="order-carrier">{t.carrier || 'Tracking'}</span>
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noopener noreferrer">{t.number}</a>
                    ) : (
                      <span>{t.number}</span>
                    )}
                    <button
                      type="button"
                      className="order-copy"
                      onClick={() => copy(t.url || t.number, t.number)}
                      title={t.url ? 'Copy tracking link' : 'Copy tracking number'}
                    >
                      {copied === t.number ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

export default OrderPanel;
