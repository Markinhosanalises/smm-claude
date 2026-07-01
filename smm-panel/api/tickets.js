// api/tickets.js
// Tickets de suporte simples.
//   POST (público, cliente)  -> abre um novo ticket
//   GET  (admin, com pin)    -> lista todos os tickets
//   PATCH-like via POST com "ticketId" + pin -> admin atualiza status/resposta

const { fbGet, fbPost, fbPatch } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin, clienteId } = req.query;

    // cliente: vê só os próprios tickets
    if (!pin && clienteId) {
      const tickets = (await fbGet('tickets')) || {};
      const lista = Object.entries(tickets)
        .filter(([, t]) => t && t.clienteId === clienteId)
        .map(([id, t]) => ({ id, ...t }))
        .sort((a, b) => b.criadoEm - a.criadoEm);
      return res.status(200).json({ tickets: lista });
    }

    // admin: vê todos
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    const tickets = (await fbGet('tickets')) || {};
    const lista = Object.entries(tickets)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => b.criadoEm - a.criadoEm);
    return res.status(200).json({ tickets: lista });
  }

  if (req.method === 'POST') {
    const { pin, ticketId, status, resposta, clienteId, nome, whatsapp, mensagem, pedidoId } = req.body || {};

    // admin atualizando um ticket existente
    if (pin === ADMIN_PIN && ticketId) {
      const update = {};
      if (status !== undefined) update.status = status;
      if (resposta !== undefined) update.resposta = resposta;
      update.respondidoEm = Date.now();
      await fbPatch(`tickets/${ticketId}`, update);
      return res.status(200).json({ ok: true });
    }

    // cliente abrindo um ticket novo
    if (!mensagem) return res.status(400).json({ erro: 'mensagem é obrigatória' });

    const ticket = {
      clienteId: clienteId || null,
      nome: nome || 'Não informado',
      whatsapp: whatsapp || null,
      mensagem,
      pedidoId: pedidoId || null,
      status: 'aberto',
      criadoEm: Date.now(),
    };
    const novo = await fbPost('tickets', ticket);
    return res.status(200).json({ ticketId: novo.name, ...ticket });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
