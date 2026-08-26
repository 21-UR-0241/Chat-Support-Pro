/**
 * Tests for the Shopify order summariser.
 *
 * Fixtures use the raw shapes Shopify actually returns, including the singular
 * and plural tracking fields, since normalising those is most of the job.
 *
 * Run: node backend/test/order-summary.test.js
 */
const assert = require('assert');
const s = require('../lib/order-summary');

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
};
const group = (name, fn) => { console.log(`\n${name}`); fn(); };

group('trackingFor', () => {
  test('reads the plural tracking fields', () => {
    const order = { fulfillments: [{ tracking_company: 'UPS', tracking_numbers: ['1Z999'], tracking_urls: ['https://ups.com/1Z999'] }] };
    assert.deepStrictEqual(s.trackingFor(order), [{ carrier: 'UPS', number: '1Z999', url: 'https://ups.com/1Z999' }]);
  });

  test('reads the singular tracking fields', () => {
    const order = { fulfillments: [{ tracking_company: 'Canada Post', tracking_number: 'CP1', tracking_url: 'https://cp.ca/CP1' }] };
    assert.deepStrictEqual(s.trackingFor(order), [{ carrier: 'Canada Post', number: 'CP1', url: 'https://cp.ca/CP1' }]);
  });

  test('keeps a tracking number that has no URL', () => {
    const order = { fulfillments: [{ tracking_number: 'NOURL' }] };
    assert.strictEqual(s.trackingFor(order).length, 1, 'the agent can still paste the number somewhere');
    assert.strictEqual(s.trackingFor(order)[0].url, null);
  });

  test('pairs multiple parcels with their own URLs', () => {
    const order = { fulfillments: [{ tracking_numbers: ['A', 'B'], tracking_urls: ['ua', 'ub'] }] };
    assert.deepStrictEqual(s.trackingFor(order).map(t => [t.number, t.url]), [['A', 'ua'], ['B', 'ub']]);
  });

  test('deduplicates a parcel repeated across fulfillment records', () => {
    const order = { fulfillments: [{ tracking_number: 'SAME' }, { tracking_number: 'SAME' }] };
    assert.strictEqual(s.trackingFor(order).length, 1);
  });

  test('returns nothing for an unfulfilled order', () => {
    assert.deepStrictEqual(s.trackingFor({ fulfillments: [] }), []);
    assert.deepStrictEqual(s.trackingFor({}), []);
    assert.deepStrictEqual(s.trackingFor(null), []);
  });
});

group('orderStatus', () => {
  const shipped = { fulfillment_status: 'fulfilled', fulfillments: [{ tracking_number: '1Z' }] };

  test('reports shipped when fulfilled with tracking', () => {
    assert.strictEqual(s.orderStatus(shipped), 'shipped');
  });

  test('distinguishes fulfilled with no tracking', () => {
    assert.strictEqual(s.orderStatus({ fulfillment_status: 'fulfilled', fulfillments: [] }), 'fulfilled, no tracking');
  });

  test('reports delivered only when the carrier said so', () => {
    const delivered = { fulfillment_status: 'fulfilled', fulfillments: [{ tracking_number: '1Z', shipment_status: 'delivered' }] };
    assert.strictEqual(s.orderStatus(delivered), 'delivered');
    assert.notStrictEqual(s.orderStatus(shipped), 'delivered', 'a printed label is not a delivery');
  });

  test('reports an unshipped order plainly', () => {
    assert.strictEqual(s.orderStatus({ financial_status: 'paid' }), 'not shipped yet');
  });

  test('surfaces refunded and cancelled', () => {
    assert.strictEqual(s.orderStatus({ financial_status: 'refunded' }), 'refunded');
    assert.strictEqual(s.orderStatus({ financial_status: 'voided' }), 'cancelled');
  });
});

group('labelWithoutScan', () => {
  test('flags a label with no carrier scan', () => {
    const order = { fulfillments: [{ tracking_number: '1Z', shipment_status: 'label_printed' }] };
    assert.strictEqual(s.labelWithoutScan(order), true,
      'this is the "label exists, carrier never took the box" case');
  });

  test('flags a label with no shipment_status at all', () => {
    assert.strictEqual(s.labelWithoutScan({ fulfillments: [{ tracking_number: '1Z' }] }), true);
  });

  test('does not flag a parcel the carrier has scanned', () => {
    const order = { fulfillments: [{ tracking_number: '1Z', shipment_status: 'in_transit' }] };
    assert.strictEqual(s.labelWithoutScan(order), false);
  });

  test('does not flag an order with no tracking at all', () => {
    assert.strictEqual(s.labelWithoutScan({ fulfillments: [] }), false,
      'nothing was promised, so there is nothing stalled');
  });
});

group('summariseOrders', () => {
  test('summarises and caps the list', () => {
    const orders = Array.from({ length: 9 }, (_, i) => ({ name: `#${i}`, fulfillments: [] }));
    assert.strictEqual(s.summariseOrders(orders).length, 5);
  });

  test('falls back to order_number when name is absent', () => {
    assert.strictEqual(s.summariseOrder({ order_number: 1042 }).orderNumber, '#1042');
  });

  test('tolerates junk input', () => {
    assert.deepStrictEqual(s.summariseOrders(null), []);
    assert.strictEqual(s.summariseOrder(null), null);
  });
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
