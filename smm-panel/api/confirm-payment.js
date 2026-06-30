// api/confirm-payment.js
// Confirma que o pagamento foi feito e SÓ AÍ envia o pedido real pro
// fornecedor. Esse endpoint deve ser chamado:
//   a) por um webhook do Mercado Pago, OU
//   b) manualmente pelo admin (enquanto o Mercado Pago não estiver plugado)
//
// IMPORTANTE: ainda não tem validação de assinatura/webhook do Mercado
// Pago aqui — isso precisa ser adicionado quando você plugar o gateway
// de pagamento de verdade. Por enquanto está protegido só por PIN pra
// você testar o fluxo manualmente.

const { fbGet, fbPatch } = require('../lib/firebase');
const { criarPedido } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { pedidoId, pin } = req.body || {};

    // TODO: quando integrar Mercado Pago, trocar essa checagem de PIN
    // pela validação da notificação/webhook oficial.
    if (pin !== ADMIN_PIN) {
      return res.status(401).json({ erro: 'PIN inválido' });
    }

    if (!pedidoId) return res.status(400).json({ erro: 'pedidoId é obrigatório' });

    const pedido = await fbGet(`pedidos/${pedidoId}`);
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

    if (pedido.status !== 'aguardando_pagamento') {
      return res.status(400).json({ erro: `Pedido já está com status "${pedido.status}"` });
    }

    // dispara o pedido de verdade pro fornecedor
    const resposta = await criarPedido({
      service: pedido.idFornecedor,
      link: pedido.link,
      quantity: pedido.quantidade,
    });

    if (!resposta.pedido && !resposta.order) {
      // fornecedor retornou erro
      await fbPatch(`pedidos/${pedidoId}`, { status: 'erro_fornecedor', erroFornecedor: resposta });
      return res.status(502).json({ erro: 'Fornecedor recusou o pedido', detalhe: resposta });
    }

    const orderIdFornecedor = resposta.pedido || resposta.order;

    await fbPatch(`pedidos/${pedidoId}`, {
      status: 'executando',
      orderIdFornecedor,
      pagoEm: Date.now(),
    });

    return res.status(200).json({ ok: true, orderIdFornecedor });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
