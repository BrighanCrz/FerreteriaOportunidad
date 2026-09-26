export type LineInput = { quantity: number; unitPrice: number };

export function calculateDocumentTotal(lines: LineInput[], discount = 0, taxRate = 0) {
  if (!lines.length) throw new Error('Agrega al menos un producto.');
  if (lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
    throw new Error('La cantidad debe ser positiva y el precio no puede ser negativo.');
  }
  const subtotal = lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) throw new Error('El descuento supera el subtotal.');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Impuesto fuera de rango.');
  const tax = (subtotal - discount) * taxRate / 100;
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export function assertSufficientStock(available: number, requested: number) {
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('La cantidad debe ser mayor que cero.');
  if (available < requested) throw new Error('Stock insuficiente.');
}

export function paymentStatus(total: number, paid: number): 'PENDIENTE' | 'PARCIAL' | 'PAGADA' {
  if (paid < 0 || paid > total) throw new Error('El pago no puede superar el saldo.');
  return paid === 0 ? 'PENDIENTE' : paid >= total ? 'PAGADA' : 'PARCIAL';
}
