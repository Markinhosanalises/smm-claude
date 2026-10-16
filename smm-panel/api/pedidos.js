const { fbGet, fbPatch, fbQuery, fbTransaction, key } = require('../lib/firebase');
const { endpoint, fail, mutation, text } = require('../lib/http');
const { session, rateLimit, requireAdmin } = require('../lib/auth');
const { statusPedido } = require('../lib/fornecedor');
module.exports = endpoint(async (req, res) => {
  if (req.method === 'POST') {
    mutation(req); await requireAdmin(req);
    if (req.body?.action === 'recuperar') return res.json({ ok: true, recuperados: await require('../lib/orders').recover() });
    const id = key(req.body?.pedidoId), action = req.body?.action;
    const p = await fbGet('pedidos/' + id);
    if (!p || !['enviando', 'revisao_fornecedor'].includes(p.status)) fail('Pedido não aguarda conciliação', 409);
    // Give a live dispatch time to finish before allowing a manual decision.
    if (p.envioIniciadoEm > Date.now() - 120000) fail('Envio ainda em andamento. Aguarde dois minutos.', 409);
    const note = text(req.body.justificativa, 'Justificativa', 1000);
    let providerId;
    if (action === 'vincular-fornecedor') {
      providerId = key(req.body.orderIdFornecedor);
      const status = await statusPedido(providerId);
      if (!status?.status || status.error) fail('Pedido não localizado no fornecedor', 409);
    } else if (action !== 'confirmar-nao-enviado') fail('Ação inválida');
    const claim = await fbTransaction('pedidos/' + id, current => {
      if (!current || !['enviando', 'revisao_fornecedor'].includes(current.status)) return;
      return { ...current, status: providerId ? 'executando' : 'erro_fornecedor', ...(providerId ? { orderIdFornecedor: providerId } : {}), conciliadoEm: Date.now(), justificativaConciliacao: note };
    });
    if (!claim.committed) fail('Pedido já conciliado', 409);
    if (!providerId) await require('../lib/orders').dispatch(id);
    return res.json({ ok: true });
  }
  if (req.method !== 'GET') fail('Método não permitido', 405);
  const admin = await session(req, 'admin', true), s = admin || await session(req);
  let items;
  if (req.query.pedidoId) {
    const id = key(req.query.pedidoId), p = await fbGet('pedidos/' + id);
    if (!p || (!admin && p.clienteId !== s.clienteId && !(s.cliente.role === 'revendedor' && p.revendedorId === s.clienteId))) fail('Pedido não encontrado',404);
    if (p.orderIdFornecedor && !['concluido','cancelado','parcial'].includes(p.status)) {
      await rateLimit(req, 'status', 60, 60000);
      const status = await statusPedido(p.orderIdFornecedor);
      const update = { statusFornecedor: status.status || null, restam: status.remains ?? status.restam ?? null, startCount: status.start_count ?? null };
      if (['Completed','Concluído'].includes(status.status)) update.status = 'concluido';
      if (['Canceled','Cancelled','Cancelado'].includes(status.status)) update.status = 'cancelado';
      if (['Partial','Parcial'].includes(status.status)) update.status = 'parcial';
      await fbPatch('pedidos/' + id, update);
      return res.json({ ...p, ...update });
    }
    return res.json(p);
  }
  if (req.query.revendedorId) {
    const id = key(req.query.revendedorId);
    if (!admin && (s.cliente.role !== 'revendedor' || id !== s.clienteId)) fail('Acesso negado', 403);
    items = await fbQuery('pedidos','revendedorId',id);
  } else if (req.query.clienteId) {
    const id = key(req.query.clienteId);
    if (!admin && id !== s.clienteId) fail('Acesso negado',403);
    items = await fbQuery('pedidos','clienteId',id);
  } else if (admin) items = await fbGet('pedidos');
  else items = await fbQuery('pedidos','clienteId',s.clienteId);
  return res.json({ pedidos: Object.entries(items || {}).filter(([,p])=>p).map(([id,p])=>({id,...p})).sort((a,b)=>b.criadoEm-a.criadoEm) });
});

