import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSufficientStock, calculateDocumentTotal, paymentStatus } from './operations';

test('calculateDocumentTotal sums lines, applies discount and tax', () => {
  assert.deepEqual(calculateDocumentTotal([{ quantity: 2, unitPrice: 100 }], 10, 12), { subtotal: 200, discount: 10, tax: 22.8, total: 212.8 });
});
test('document totals reject empty lines, negative price and excessive discount', () => {
  assert.throws(() => calculateDocumentTotal([]));
  assert.throws(() => calculateDocumentTotal([{ quantity: 1, unitPrice: -1 }]));
  assert.throws(() => calculateDocumentTotal([{ quantity: 1, unitPrice: 10 }], 11));
});
test('stock guard prevents selling more than the available quantity', () => {
  assert.doesNotThrow(() => assertSufficientStock(4, 4));
  assert.throws(() => assertSufficientStock(3, 4), /Stock insuficiente/);
});
test('payment state follows recorded receipts and blocks overpayment', () => {
  assert.equal(paymentStatus(100, 0), 'PENDIENTE');
  assert.equal(paymentStatus(100, 25), 'PARCIAL');
  assert.equal(paymentStatus(100, 100), 'PAGADA');
  assert.throws(() => paymentStatus(100, 101));
});
