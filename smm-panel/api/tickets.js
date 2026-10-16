const { fbGet, fbPost, fbPatch, fbQuery, key } = require('../lib/firebase');
const { endpoint, mutation, fail, text } = require('../lib/http');
const { session, requireAdmin, rateLimit } = require('../lib/auth');
module.exports = endpoint(async (req, res) => {
  const admin = await session(req, 'admin', true);
  if (req.method === 'GET') {
    const s = admin || await session(req);
    if (!admin && req.query.clienteId && req.query.clienteId !== s.clienteId) fail('Acesso negado', 403);
    const items = admin ? await fbGet('tickets') : await fbQuery('tickets', 'clienteId', s.clienteId);
    return res.json({ tickets: Object.entries(items || {}).filter(([,t]) => t).map(([id,t]) => ({ id, ...t })).sort((a,b) => b.criadoEm - a.criadoEm) });
  }
  mutation(req);
  const b = req.body || {};
  if (b.ticketId) {
    await requireAdmin(req);
    const id = key(b.ticketId);
    if (!await fbGet('tickets/' + id)) fail('Ticket não encontrado', 404);
    const update = { respondidoEm: Date.now() };
    if (b.status !== undefined) { if (!['aberto','resolvido'].includes(b.status)) fail('Status inválido'); update.status = b.status; }
    if (b.resposta !== undefined) update.resposta = text(b.resposta, 'Resposta', 5000);
    await fbPatch('tickets/' + id, update);
    return res.json({ ok: true });
  }
  const s = await session(req);
  await rateLimit(req, 'ticket', 10, 60000);
  const pedidoId = b.pedidoId ? key(b.pedidoId) : null;
  if (pedidoId) { const p = await fbGet('pedidos/' + pedidoId); if (!p || p.clienteId !== s.clienteId) fail('Pedido não encontrado',404); }
  const ticket = { clienteId: s.clienteId, nome: s.cliente.nome, whatsapp: s.cliente.whatsapp, mensagem: text(b.mensagem, 'Mensagem', 5000), pedidoId, status:'aberto', criadoEm: Date.now() };
  const r = await fbPost('tickets', ticket);
  return res.json({ ticketId: r.name, ...ticket });
});

