const { endpoint, mutation, fail } = require('../lib/http');
const { session, requireAdmin, rateLimit } = require('../lib/auth');
const { fbGet, key } = require('../lib/firebase');
const { verifySignature, createPix, confirmPayment } = require('../lib/payments');
module.exports = endpoint(async (req, res) => {
  if (req.method === 'POST' && req.query.action === 'webhook') {
    const id = verifySignature(req);
    if (req.body?.type && req.body.type !== 'payment') return res.json({ ok: true });
    return res.json(await confirmPayment(id));
  }
  mutation(req);
  if (req.body?.action === 'verificar') {
    await requireAdmin(req);
    const p = await fbGet('pedidos/' + key(req.body.pedidoId));
    if (!p?.paymentId) fail('Pedido sem cobrança PIX', 409);
    return res.json(await confirmPayment(p.paymentId));
  }
  const s = await session(req);
  await rateLimit(req, 'pix', 20, 60000);
  const id = key(req.body?.pedidoId), p = await fbGet('pedidos/' + id);
  if (!p || p.clienteId !== s.clienteId) fail('Pedido não encontrado', 404);
  if (p.status !== 'aguardando_pagamento' || p.pagamento !== 'pix') fail('Pedido não aguarda pagamento', 409);
  return res.json(await createPix(id, p, 'pedidos/' + id));
});

