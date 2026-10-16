// Compatibility route: always verifies the actual payment at Mercado Pago.
const { endpoint, mutation, fail } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { fbGet, key } = require('../lib/firebase');
const { confirmPayment } = require('../lib/payments');
module.exports = endpoint(async (req, res) => {
  mutation(req); await requireAdmin(req);
  const p = await fbGet('pedidos/' + key(req.body?.pedidoId));
  if (!p?.paymentId) fail('Pedido sem cobrança PIX', 409);
  return res.json(await confirmPayment(p.paymentId));
});

