const { fbGet, fbTransaction, key } = require('./firebase');
const { fail } = require('./http');
const { cancelarPedido, listarServicos } = require('./fornecedor');
const { balanceCents } = require('./wallet');
const terminal = p => ['concluido','cancelado','parcial','estornado','estorno_pix_pendente'].includes(p?.status);
const allowed = v => v === true || v === 1 || v === '1';
function eligible(p, service) {
  return p?.status === 'executando' && !!p.orderIdFornecedor && allowed(service?.cancel) && !p.cancelamento;
}
function view(p, service) {
  return { ...p, podeSolicitarCancelamento: eligible(p, service) };
}
// The order, balance and ledger are committed together. This also covers a retry
// after an uncertain database response, without a second credit.
async function settle(id) {
  key(id);
  const r = await fbTransaction('', root => {
    const p = root?.pedidos?.[id], c = p?.cancelamento;
    if (!c || !['cancelado','parcial'].includes(p.status) || c.reembolsoEstado === 'creditado' || c.reembolsoEstado === 'sem_valor') return;
    const qty = Number(p.quantidade), raw = p.restam;
    const remains = raw === null || raw === undefined || String(raw).trim() === '' ? NaN : Number(raw);
    const amount = p.valorCentavos, w = root.carteiras?.[p.clienteId] || {};
    const debit = w.movimentos?.['order_' + id];
    const proof = p.pagamento === 'saldo' ? debit?.centavos === -amount : p.pagamento === 'pix' && p.paymentId && p.pagoEm;
    const safe = p.workflowVersion === 2 && Number.isSafeInteger(amount) && amount > 0 && proof &&
      Number.isSafeInteger(qty) && qty > 0 && Number.isSafeInteger(remains) && remains >= 0 && remains <= qty &&
      !p.assinatura && !p.refundId && !p.estornadoEm && !w.movimentos?.['refund_' + id] &&
      (!p.pacote || remains === 0 || remains === qty);
    const now = Date.now();
    if (!safe) {
      if (c.reembolsoEstado === 'revisao') return;
      return { ...root, pedidos: { ...root.pedidos, [id]: { ...p, cancelamento: { ...c, estado: 'confirmado', reembolsoEstado: 'revisao' } } } };
    }
    const cents = Number((BigInt(amount) * BigInt(remains) + BigInt(qty) / 2n) / BigInt(qty)), op = 'cancel_refund_' + id;
    if (w.movimentos?.[op]) return; // Never credit again if an inconsistent old record needs review.
    const next = balanceCents(w) + cents;
    if (!Number.isSafeInteger(next)) return;
    return { ...root,
      pedidos: { ...root.pedidos, [id]: { ...p, cancelamento: { ...c, estado: 'confirmado', confirmadoEm: c.confirmadoEm || now, reembolsoEstado: cents ? 'creditado' : 'sem_valor', reembolsoCentavos: cents, reembolsadoEm: now } } },
      ...(cents ? { carteiras: { ...root.carteiras, [p.clienteId]: { ...w, saldoCentavos: next, saldo: next / 100, ultimoCredito: now, movimentos: { ...w.movimentos, [op]: { centavos: cents, criadoEm: now } } } } } : {})
    };
  });
  return r.value?.pedidos?.[id] || await fbGet('pedidos/' + id);
}
async function request(id, customerId) {
  key(id); key(customerId);
  let p = await fbGet('pedidos/' + id);
  if (!p || p.clienteId !== customerId) fail('Pedido não encontrado', 404);
  if (p.cancelamento) return require('./order-status').refresh(id, p);
  if (terminal(p) || p.status !== 'executando' || !p.orderIdFornecedor) fail('Este pedido não permite solicitar cancelamento.', 409);
  // Check the current provider catalog, rather than trusting the browser or an old snapshot.
  const catalog = await listarServicos();
  if (!Array.isArray(catalog)) fail('Não foi possível confirmar se o serviço permite cancelamento. Tente novamente.', 503);
  const service = catalog.find(s => String(s.service) === String(p.idFornecedor));
  if (!allowed(service?.cancel)) fail('O fornecedor não permite cancelamento para este serviço.', 409);
  p = await require('./order-status').refresh(id, p);
  if (terminal(p)) fail('O pedido já foi finalizado pelo fornecedor.', 409);
  const claim = await fbTransaction('pedidos/' + id, current => {
    if (current?.clienteId !== customerId || current.status !== 'executando' || current.cancelamento || String(current.orderIdFornecedor) !== String(p.orderIdFornecedor)) return;
    return { ...current, cancelamento: { estado: 'enviando', solicitadoEm: Date.now(), solicitadoPor: customerId } };
  });
  if (!claim.committed) return await fbGet('pedidos/' + id);
  let state = 'incerto';
  try {
    const reply = await cancelarPedido(p.orderIdFornecedor);
    const item = Array.isArray(reply) ? reply.find(s => String(s.order) === String(p.orderIdFornecedor)) : null;
    if (item?.cancel === 1 || item?.cancel === '1') state = 'solicitado';
    else if (item?.cancel?.error || item?.error || reply?.error || reply?.erro) state = 'recusado';
  } catch { /* The provider might have received the request. Never send it twice automatically. */ }
  await fbTransaction('pedidos/' + id, current => {
    if (current?.cancelamento?.estado !== 'enviando') return;
    return { ...current, cancelamento: { ...current.cancelamento, estado: state, respostaEm: Date.now() } };
  });
  // Status calls can fail independently of a successfully submitted cancellation.
  try { return await require('./order-status').refresh(id); }
  catch { return await fbGet('pedidos/' + id); }
}
module.exports = { request, settle, eligible, view };
