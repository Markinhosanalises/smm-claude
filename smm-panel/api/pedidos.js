// api/pedidos.js
// Unifica 3 funções antigas (status.js, meus-pedidos.js, admin-orders.js)
// pra ficar dentro do limite de 12 Serverless Functions do plano Hobby.
//
//   GET ?pedidoId=X        -> status de um pedido (sincroniza com o fornecedor se já enviado)
//   GET ?clienteId=X       -> lista os pedidos daquele cliente
//   GET ?pin=ADMIN_PIN     -> lista TODOS os pedidos (admin)

const { fbGet, fbPatch } = require('../lib/firebase');
const { statusPedido } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const { pedidoId, clienteId, pin } = req.query;

  try {
    // ----- status de um pedido específico -----
    if (pedidoId) {
      const pedido = await fbGet(`pedidos/${pedidoId}`);
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

      if (!pedido.orderIdFornecedor) {
        return res.status(200).json(pedido);
      }

      const statusFornecedor = await statusPedido(pedido.orderIdFornecedor);
      const update = {
        statusFornecedor: statusFornecedor.status || null,
        restam: statusFornecedor.restam ?? null,
        startCount: statusFornecedor.start_count ?? null,
      };
      if (statusFornecedor.status === 'Concluído' || statusFornecedor.status === 'Completed') {
        update.status = 'concluido';
      } else if (statusFornecedor.status === 'Cancelado' || statusFornecedor.status === 'Canceled') {
        update.status = 'cancelado';
      }
      await fbPatch(`pedidos/${pedidoId}`, update);
      return res.status(200).json({ ...pedido, ...update });
    }

    // ----- pedidos de um cliente específico -----
    if (clienteId) {
      const pedidos = (await fbGet('pedidos')) || {};
      const lista = Object.entries(pedidos)
        .filter(([, p]) => p && p.clienteId === clienteId)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.criadoEm - a.criadoEm);
      return res.status(200).json({ pedidos: lista });
    }

    // ----- todos os pedidos (admin) -----
    if (pin === ADMIN_PIN) {
      const pedidos = (await fbGet('pedidos')) || {};
      const lista = Object.entries(pedidos)
        .filter(([, p]) => p)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => b.criadoEm - a.criadoEm);
      return res.status(200).json({ pedidos: lista });
    }

    return res.status(400).json({ erro: 'Informe pedidoId, clienteId, ou pin (admin)' });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
