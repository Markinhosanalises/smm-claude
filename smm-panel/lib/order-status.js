const { fbGet, fbPatch, key } = require('./firebase');
const { statusPedido } = require('./fornecedor');
async function refresh(id, p) {
  key(id);
  p = p || await fbGet('pedidos/' + id);
  if (!p?.orderIdFornecedor || ['concluido','cancelado','parcial'].includes(p.status)) return p;
  const status = await statusPedido(p.orderIdFornecedor);
  if (!status?.status || status.error || status.erro) return p;
  const update = { statusFornecedor: status.status, restam: status.remains ?? status.restam ?? null, startCount: status.start_count ?? null };
  if (['Completed','Concluído'].includes(status.status)) update.status = 'concluido';
  if (['Canceled','Cancelled','Cancelado'].includes(status.status)) update.status = 'cancelado';
  if (['Partial','Parcial'].includes(status.status)) update.status = 'parcial';
  await fbPatch('pedidos/' + id, update);
  return { ...p, ...update };
}
module.exports = { refresh };
