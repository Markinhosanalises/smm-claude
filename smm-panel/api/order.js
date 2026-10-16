const { endpoint, mutation } = require('../lib/http');
const { session, rateLimit } = require('../lib/auth');
const { create, requestKey } = require('../lib/orders');
module.exports = endpoint(async (req, res) => {
  mutation(req);
  const s = await session(req);
  await rateLimit(req, 'order', 60, 60000);
  return res.json(await create(s.clienteId, s.cliente, req.body || {}, requestKey(req)));
});

