// Business operations shared by several pages (stock, order status, invoice numbers).
import { CONFIG } from './config.js';
import { num } from './ui.js';

// Change a saree's piece count and log the movement. Sarees in "availability"
// mode or without a quantity aren't counted, so only the log is written.
export async function adjustStock(api, sareeId, delta, reason, ref) {
  const s = await api.get('sarees', sareeId);
  if (!s) return null;
  const tracked = s.stockMode !== 'availability' && s.quantity != null;
  const before = tracked ? num(s.quantity) : null;
  const after = tracked ? Math.max(0, before + delta) : null;
  if (tracked) await api.update('sarees', sareeId, { quantity: after });
  try {
    await api.add('stockMoves', { sareeId, name: s.name, delta, reason, ref: ref || '', before, after, by: (api.session() || {}).email || '' });
  } catch (e) { console.warn('Stock log not saved:', e.message); }
  return { before, after, tracked };
}

// Cancelling or returning puts stock back once;
// un-cancelling takes it off again. `stockRestored` keeps it idempotent.
export async function changeOrderStatus(api, order, newStatus) {
  const unwound = CONFIG.unwoundStatuses;
  const isUnwound = unwound.includes(newStatus);
  const restore = isUnwound && order.stockRestored !== true;
  const takeBack = !isUnwound && order.stockRestored === true;
  const patch = { status: newStatus };
  if (restore || takeBack) {
    const sign = restore ? 1 : -1;
    for (const line of order.items || []) {
      if (!line.itemId) continue;
      try { await adjustStock(api, line.itemId, sign * num(line.qty, 1), restore ? 'Order ' + newStatus : 'Order reopened', order.invoiceNo || order.id); }
      catch (e) { console.warn('Stock sync failed for', line.itemId, e); }
    }
    patch.stockRestored = restore;
  }
  if (isUnwound) { patch.cancelledAt = api.NOW; patch.cancelledBy = (api.session() || {}).email || ''; }
  await api.update('orders', order.id, patch);
  Object.assign(order, patch);
  return order;
}

export function invoiceNo(project) {
  const p = (project.paymentConfig && project.paymentConfig.invoicePrefix) || 'YK-';
  const d = new Date();
  return p + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getTime()).slice(-4);
}

export const normalizeMobile = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  return d.length >= 10 ? '+' + d : '';
};
