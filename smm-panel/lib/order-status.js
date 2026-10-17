const { fbGet, fbTransaction, key } = require('./firebase');
const { statusPedido } = require('./fornecedor');
async function refresh(id, p) {
  key(id);
  p = p || await fbGet('pedidos/' + id);
  if (!p?.orderIdFornecedor) return p;
  if (['concluido','cancelado','parcial','estornado','estorno_pix_pendente'].includes(p.status)) {
    return p.cancelamento && ['cancelado','parcial'].includes(p.status) ? require('./order-cancellation').settle(id) : p;
  }
  const status = await statusPedido(p.orderIdFornecedor);
  if (!status?.status || status.error || status.erro) return p;
  const update = { statusFornecedor: status.status, restam: status.remains ?? status.restam ?? null, startCount: status.start_count ?? null, ultimaConsultaFornecedorEm: Date.now() };
  if (['Completed','Concluído'].includes(status.status)) update.status = 'concluido';
  if (['Canceled','Cancelled','Cancelado'].includes(status.status)) update.status = 'cancelado';
  if (['Partial','Parcial'].includes(status.status)) update.status = 'parcial';
  const r = await fbTransaction('pedidos/' + id, current => {
    if (!current || String(current.orderIdFornecedor) !== String(p.orderIdFornecedor) || ['concluido','cancelado','parcial','estornado','estorno_pix_pendente'].includes(current.status)) return;
    return { ...current, ...update };
  });
  p = r.value || await fbGet('pedidos/' + id);
  if (p?.cancelamento && ['cancelado','parcial'].includes(p.status)) return require('./order-cancellation').settle(id);
  return p;
}
module.exports = { refresh };
