// backend/lib/order-summary.js
//
// Turns a raw Shopify order into the shape the agent panel renders.
//
// Kept pure and dependency-free so it can be tested without a Shopify token or a
// network call: everything here is a function of the JSON Shopify already
// returned. The API wrapper fetches, this decides what an agent needs to see.

/**
 * Shopify reports tracking in several shapes depending on how the fulfillment
 * was created — singular `tracking_number`, plural `tracking_numbers`, and the
 * same for URLs — and the two lists are positional rather than paired. Flatten
 * them into one list of {carrier, number, url} so callers never have to know.
 *
 * A number without a URL still matters: the agent can paste it into the
 * carrier's own site. A URL without a number does not, so it is dropped.
 */
function trackingFor(order) {
  const out = [];
  for (const f of order?.fulfillments || []) {
    const numbers = f.trackingNumbers?.length ? f.trackingNumbers
      : (f.tracking_numbers?.length ? f.tracking_numbers
        : (f.trackingNumber || f.tracking_number ? [f.trackingNumber || f.tracking_number] : []));
    const urls = f.trackingUrls?.length ? f.trackingUrls
      : (f.tracking_urls?.length ? f.tracking_urls
        : (f.trackingUrl || f.tracking_url ? [f.trackingUrl || f.tracking_url] : []));
    const carrier = f.trackingCompany || f.tracking_company || null;

    numbers.forEach((number, i) => {
      if (!number) return;
      out.push({ carrier, number: String(number), url: urls[i] || urls[0] || null });
    });
  }

  // The same parcel can appear on more than one fulfillment record after an
  // edit; the agent should see one row per parcel, not per record.
  const seen = new Set();
  return out.filter(t => !seen.has(t.number) && seen.add(t.number));
}

/**
 * A plain-language status for the agent, since Shopify's two status fields read
 * as jargon and neither alone answers "has this shipped".
 *
 * Deliberately does NOT claim delivery: `shipment_status` comes from the carrier
 * and is frequently absent or stale, so "delivered" is only stated when the
 * carrier actually said so.
 */
function orderStatus(order) {
  const fin = (order?.financialStatus || order?.financial_status || '').toLowerCase();
  const ful = (order?.fulfillmentStatus || order?.fulfillment_status || '').toLowerCase();
  const shipment = (order?.fulfillments || [])
    .map(f => (f.shipmentStatus || f.shipment_status || '').toLowerCase())
    .filter(Boolean);

  if (shipment.includes('delivered')) return 'delivered';
  if (ful === 'fulfilled') return trackingFor(order).length ? 'shipped' : 'fulfilled, no tracking';
  if (ful === 'partial') return 'partially shipped';
  if (fin === 'refunded') return 'refunded';
  if (fin === 'voided' || fin === 'cancelled') return 'cancelled';
  if (fin === 'pending') return 'awaiting payment';
  return 'not shipped yet';
}

/**
 * True when a label exists but no carrier scan has been reported.
 *
 * This is the "two labels came and went and UPS never had the box" case. Shopify
 * cannot confirm a physical handoff — only a carrier API can — so this is a
 * FLAG FOR THE AGENT TO CHECK, never a statement that the parcel is stuck.
 */
function labelWithoutScan(order) {
  const hasTracking = trackingFor(order).length > 0;
  if (!hasTracking) return false;
  return (order.fulfillments || []).every(f => {
    const s = (f.shipmentStatus || f.shipment_status || '').toLowerCase();
    return !s || s === 'label_printed' || s === 'label_purchased';
  });
}

function summariseOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.name || (order.order_number != null ? `#${order.order_number}` : null),
    placedAt: order.createdAt || order.created_at || null,
    total: order.totalPrice || order.total_price || null,
    currency: order.currency || null,
    status: orderStatus(order),
    tracking: trackingFor(order),
    awaitingCarrierScan: labelWithoutScan(order),
    items: (order.lineItems || order.line_items || []).map(i => ({
      title: i.title,
      quantity: i.quantity,
    })),
  };
}

function summariseOrders(orders, limit = 5) {
  return (Array.isArray(orders) ? orders : [])
    .slice(0, limit)
    .map(summariseOrder)
    .filter(Boolean);
}

module.exports = { trackingFor, orderStatus, labelWithoutScan, summariseOrder, summariseOrders };
