const { fbGet, fbTransaction, fbQuery, key } = require('../lib/firebase');
const { endpoint, mutation, fail, number } = require('../lib/http');
const { session, requireAdmin, rateLimit, digest } = require('../lib/auth');
const { balanceCents, change } = require('../lib/wallet');
const { createPix } = require('../lib/payments');
const { requestKey } = require('../lib/orders');
module.exports = endpoint(async (req, res) => {
  if (req.method === 'GET') {
    const admin = await session(req, 'admin', true);
    if (req.query.todos === '1') {
      if (!admin) await requireAdmin(req);
      const [customers, wallets] = await Promise.all([fbGet('clientes'), fbGet('carteiras')]);
      const clientes = Object.entries(customers || {}).filter(([,c]) => c).map(([id,c]) => ({
        clienteId: id, whatsapp: c.whatsapp || id, nome: c.nome || '', usuario: c.usuario || '',
        origem: c.origem || '', desconto: c.desconto || 0, role: c.role || 'cliente',
        saldo: balanceCents(wallets?.[id]) / 100, ultimoCredito: wallets?.[id]?.ultimoCredito || null, criadoEm: c.criadoEm || null
      })).sort((a,b) => (b.criadoEm || 0) - (a.criadoEm || 0));
      return res.json({ clientes });
    }
    const s = admin || await session(req);
    const id = admin ? key(req.query.clienteId) : s.clienteId;
    if (!admin && req.query.clienteId && req.query.clienteId !== id) fail('Acesso negado', 403);
    const saldo = balanceCents(await fbGet('carteiras/' + id)) / 100;
    if (req.query.action === 'historico') {
      const depositos = await fbQuery('depositos', 'clienteId', id);
      return res.json({ saldo, depositos: depositos || {} });
    }
    return res.json({ saldo });
  }
  mutation(req);
  const b = req.body || {};
  if (b.creditar) {
    await requireAdmin(req);
    const id = key(b.clienteId);
    if (!await fbGet('clientes/' + id)) fail('Cliente não encontrado', 404);
    const cents = Math.round(number(b.valor, 'Valor', 0.01, 1000000) * 100);
    return res.json({ ok: true, novoSaldo: await change(id, cents, 'admin_' + digest(requestKey(req))) });
  }
  const s = await session(req);
  await rateLimit(req, 'deposit', 20, 60000);
  const config = await fbGet('config');
  const value = number(b.valor, 'Valor', Math.max(0.01, Number(config?.minRecarga || 5)), 1000000);
  const cents = Math.round(value * 100);
  const id = 'dep_' + digest(s.clienteId + ':' + requestKey(req));
  const candidate = { clienteId: s.clienteId, valor: cents / 100, valorCentavos: cents, status: 'pendente', criadoEm: Date.now() };
  const r = await fbTransaction('depositos/' + id, current => current || candidate);
  if (r.value.valorCentavos !== cents) fail('Chave já usada com outro valor', 409);
  return res.json({ depositoId: id, ...await createPix(id, r.value, 'depositos/' + id) });
});

