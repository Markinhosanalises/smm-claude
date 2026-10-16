const { fbGet, fbPut, fbPatch, fbTransaction, key } = require('./firebase');
const { total } = require('./pricing');
const { url, text, fail } = require('./http');
const { digest } = require('./auth');
const wallet = require('./wallet');
const { criarPedido } = require('./fornecedor');
function requestKey(req) {
  const value = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(value)) fail('Envie Idempotency-Key com 16 a 100 caracteres');
  return value;
}
async function refund(id, p) {
  if (p.pagamento === 'pix') {
    await require('./payments').refundPix(id, p);
    return;
  }
  await wallet.change(p.clienteId, p.valorCentavos, 'refund_' + id);
  await fbPatch('pedidos/' + id, { status: 'estornado', estornadoEm: Date.now() });
}
async function dispatch(id) {
  key(id);
  const before = await fbGet('pedidos/' + id);
  if (!before) fail('Pedido não encontrado', 404);
  if (['erro_fornecedor', 'estorno_pix_pendente'].includes(before.status)) { await refund(id, before); return fbGet('pedidos/' + id); }
  const claim = await fbTransaction('pedidos/' + id, p => {
    if (!p || p.status !== 'pago') return;
    return { ...p, status: 'enviando', envioIniciadoEm: Date.now() };
  });
  if (!claim.committed) return fbGet('pedidos/' + id);
  const p = claim.value;
  let reply;
  try { reply = await criarPedido({ service: p.idFornecedor, link: p.link, quantity: p.quantidade, ...(p.comments ? { comments: p.comments } : {}) }); }
  catch {
    // A timeout may mean the provider accepted the order. Never retry/refund automatically.
    await fbPatch('pedidos/' + id, { status: 'revisao_fornecedor', erroFornecedor: 'Resultado do envio desconhecido. Conferir no fornecedor antes de qualquer reenvio.' });
    return fbGet('pedidos/' + id);
  }
  const providerId = reply?.pedido || reply?.order;
  if (providerId) {
    await fbPatch('pedidos/' + id, { status: 'executando', orderIdFornecedor: providerId, enviadoEm: Date.now() });
  } else if (reply && typeof reply === 'object' && (reply.error || reply.erro)) {
    await fbPatch('pedidos/' + id, { status: 'erro_fornecedor', erroFornecedor: String(reply.error || reply.erro).slice(0, 500) });
    await refund(id, p);
  } else {
    await fbPatch('pedidos/' + id, { status: 'revisao_fornecedor', erroFornecedor: 'Resposta sem confirmação. Conferir no fornecedor.' });
  }
  return fbGet('pedidos/' + id);
}
async function create(customerId, customer, body, operation) {
  const service = key(body.idFornecedor ?? body.service);
  const link = url(body.link, 'Link');
  const quantity = body.quantidade ?? body.quantity;
  const comments = body.comments ? text(body.comments, 'Comentários', 10000) : null;
  const payment = body.pagarComSaldo === false ? 'pix' : 'saldo';
  const fingerprint = digest(JSON.stringify({ service, link, quantity: Number(quantity), comments, payment }));
  const id = digest(customerId + ':' + operation);
  let p = await fbGet('pedidos/' + id);
  if (!p) {
    const [s, config] = await Promise.all([fbGet('catalogo/' + service), fbGet('config')]);
    const price = total(s, config || {}, customer, quantity);
    const counter = await fbTransaction('config/contadorPedidos', n => Number(n || 0) + 1);
    const candidate = {
      numeroPedido: '#' + String(counter.value).padStart(5, '0'), idFornecedor: service,
      nomeServico: s.nomeCustomizado || s.nomeOriginal || '', link, quantidade: price.qtd,
      valorCentavos: price.cents, valorTotal: price.value, status: payment === 'saldo' ? 'processando_saldo' : 'aguardando_pagamento',
      clienteId: customerId, ...(customer.revendedorId ? { revendedorId: customer.revendedorId } : {}),
      pagamento: payment, comments, fingerprint, criadoEm: Date.now()
    };
    const r = await fbTransaction('pedidos/' + id, current => current || candidate);
    p = r.value;
  }
  if (p.fingerprint !== fingerprint) fail('Chave de idempotência já usada com outro pedido', 409);
  if (p.status === 'processando_saldo') {
    try { await wallet.change(customerId, -p.valorCentavos, 'order_' + id); }
    catch (err) {
      if (err.status === 409) await fbTransaction('pedidos/' + id, current => current?.status === 'processando_saldo' ? { ...current, status: 'saldo_insuficiente' } : undefined);
      throw err;
    }
    await fbTransaction('pedidos/' + id, current => current?.status === 'processando_saldo' ? { ...current, status: 'pago', pagoEm: Date.now() } : undefined);
  }
  if (p.status === 'saldo_insuficiente') fail('Saldo insuficiente. Inicie um novo pedido após recarregar.', 409);
  if (payment === 'saldo') p = await dispatch(id);
  else p = await fbGet('pedidos/' + id);
  const { fingerprint: ignored, ...safe } = p;
  return { pedidoId: id, ...safe, ...(payment === 'saldo' ? { novoSaldo: wallet.balanceCents(await fbGet('carteiras/' + customerId)) / 100 } : {}) };
}
async function recover() {
  const items = await fbGet('pedidos');
  let recovered = 0;
  for (const [id, p] of Object.entries(items || {})) {
    if (!p) continue;
    if (p.status === 'processando_saldo') {
      const w = await fbGet('carteiras/' + key(p.clienteId));
      if (w?.movimentos?.['order_' + id]?.centavos === -p.valorCentavos) {
        await fbTransaction('pedidos/' + id, current => current?.status === 'processando_saldo' ? { ...current, status: 'pago', pagoEm: Date.now() } : undefined);
      } else continue;
    } else if (!['pago', 'erro_fornecedor', 'estorno_pix_pendente'].includes(p.status)) continue;
    await dispatch(id); recovered++;
  }
  return recovered;
}
module.exports = { create, dispatch, requestKey, recover, refund };
