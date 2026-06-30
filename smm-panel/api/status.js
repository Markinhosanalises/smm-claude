// api/status.js
// Consulta o status de um pedido. Se já foi enviado pro fornecedor,
// consulta o status real lá e atualiza no Firebase.

const { fbGet, fbPatch } = require('../lib/firebase');
const { statusPedido } = require('../lib/fornecedor');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { pedidoId } = req.query;
  if (!pedidoId) return res.status(400).json({ erro: 'pedidoId é obrigatório' });

  try {
    const pedido = await fbGet(`pedidos/${pedidoId}`);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

    if (!pedido.orderIdFornecedor) {
      // ainda não foi enviado pro fornecedor (aguardando pagamento, erro, etc.)
      return res.status(200).json(pedido);
    }

    const statusFornecedor = await statusPedido(pedido.orderIdFornecedor);

    const update = {
      statusFornecedor: statusFornecedor.status || null,
      restam: statusFornecedor.restam ?? null,
      startCount: statusFornecedor.start_count ?? null,
    };

    // mapeia o status do fornecedor pro status interno
    if (statusFornecedor.status === 'Concluído' || statusFornecedor.status === 'Completed') {
      update.status = 'concluido';
    } else if (statusFornecedor.status === 'Cancelado' || statusFornecedor.status === 'Canceled') {
      update.status = 'cancelado';
    }

    await fbPatch(`pedidos/${pedidoId}`, update);

    return res.status(200).json({ ...pedido, ...update });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
