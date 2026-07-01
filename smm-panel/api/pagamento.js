// api/pagamento.js
// Gera uma cobrança PIX via Mercado Pago e salva o payment_id no pedido.
// Também recebe o webhook do MP (action=webhook) e confirma o pagamento.

const { fbGet, fbPatch } = require('../lib/firebase');
const { criarPedido } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

async function getAccessToken() {
  const config = await fbGet('config');
  const token = config?.mercadopago?.accessToken;
  if (!token) throw new Error('Access Token do Mercado Pago não configurado. Configure em Integrações no painel admin.');
  return token;
}

// Gera cobrança PIX no Mercado Pago
async function gerarPIX({ pedidoId, valor, descricao, clienteWhatsapp }) {
  const accessToken = await getAccessToken();
  const config = await fbGet('config');
  const appUrl = (config?.appUrl || '').replace(/\/$/, '');

  if (!appUrl) throw new Error('URL do site não configurada. Vá em Integrações no admin e preencha a URL.');

  const body = {
    transaction_amount: Number(valor),
    description: descricao || 'Serviço de engajamento',
    payment_method_id: 'pix',
    payer: {
      email: `cliente_${clienteWhatsapp || pedidoId}@engaja.app`,
    },
    external_reference: pedidoId,
    notification_url: `${appUrl}/api/pagamento?action=webhook`,
  };

  const resp = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': pedidoId,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`MP erro ${resp.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

module.exports = async (req, res) => {
  // ===== WEBHOOK DO MERCADO PAGO =====
  if (req.method === 'POST' && req.query.action === 'webhook') {
    try {
      const { action, data } = req.body || {};

      // MP envia action="payment.updated" quando o status muda
      if (action !== 'payment.updated' || !data?.id) {
        return res.status(200).json({ ok: true }); // ignora outros eventos
      }

      const accessToken = await getAccessToken();
      const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const payment = await paymentResp.json();

      if (payment.status !== 'approved') {
        return res.status(200).json({ ok: true, status: payment.status });
      }

      const pedidoId = payment.external_reference;
      if (!pedidoId) return res.status(200).json({ ok: true });

      // verifica se é recarga de saldo
      if (pedidoId.startsWith('dep_')) {
        const deposito = await fbGet(`depositos/${pedidoId}`).catch(() => null);
        if (!deposito || deposito.status === 'confirmado') {
          return res.status(200).json({ ok: true });
        }
        const { creditarSaldo } = require('./carteira');
        const novoSaldo = await creditarSaldo(deposito.clienteId, deposito.valor);
        await fbPatch(`depositos/${pedidoId}`, { status: 'confirmado', confirmedEm: Date.now() });
        return res.status(200).json({ ok: true, novoSaldo });
      }

      // pedido normal
      const pedido = await fbGet(`pedidos/${pedidoId}`);
      if (!pedido || pedido.status !== 'aguardando_pagamento') {
        return res.status(200).json({ ok: true }); // já processado
      }

      // dispara o pedido pro fornecedor
      const resposta = await criarPedido({
        service: pedido.idFornecedor,
        link: pedido.link,
        quantity: pedido.quantidade,
        ...(pedido.comments ? { comments: pedido.comments } : {}),
      });

      const orderIdFornecedor = resposta.pedido || resposta.order;
      await fbPatch(`pedidos/${pedidoId}`, {
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        orderIdFornecedor: orderIdFornecedor || null,
        paymentId: payment.id,
        pagoEm: Date.now(),
        erroFornecedor: orderIdFornecedor ? null : resposta,
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Webhook MP erro:', err.message);
      return res.status(500).json({ erro: err.message });
    }
  }

  // ===== GERAR PIX (cliente clica em "Efetuar pagamento") =====
  if (req.method === 'POST') {
    try {
      const { pedidoId } = req.body || {};
      if (!pedidoId) return res.status(400).json({ erro: 'pedidoId é obrigatório' });

      const pedido = await fbGet(`pedidos/${pedidoId}`);
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
      if (pedido.status !== 'aguardando_pagamento') {
        return res.status(400).json({ erro: `Pedido já está com status "${pedido.status}"` });
      }

      const payment = await gerarPIX({
        pedidoId,
        valor: pedido.valorTotal,
        descricao: pedido.nomeServico,
        clienteWhatsapp: pedido.clienteId,
      });

      const pixData = payment.point_of_interaction?.transaction_data;

      await fbPatch(`pedidos/${pedidoId}`, {
        paymentId: payment.id,
        pixQrCode: pixData?.qr_code || null,
        pixQrCodeBase64: pixData?.qr_code_base64 || null,
        pixStatus: payment.status,
      });

      return res.status(200).json({
        paymentId: payment.id,
        qrCode: pixData?.qr_code,
        qrCodeBase64: pixData?.qr_code_base64,
        valorTotal: pedido.valorTotal,
        status: payment.status,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // ===== CONFIRMAR MANUALMENTE (admin, fallback sem webhook) =====
  if (req.method === 'GET' && req.query.pin === ADMIN_PIN) {
    const { pedidoId } = req.query;
    if (!pedidoId) return res.status(400).json({ erro: 'pedidoId obrigatório' });

    try {
      const pedido = await fbGet(`pedidos/${pedidoId}`);
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

      const resposta = await criarPedido({
        service: pedido.idFornecedor,
        link: pedido.link,
        quantity: pedido.quantidade,
      });

      const orderIdFornecedor = resposta.pedido || resposta.order;
      await fbPatch(`pedidos/${pedidoId}`, {
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        orderIdFornecedor: orderIdFornecedor || null,
        pagoEm: Date.now(),
      });

      return res.status(200).json({ ok: true, orderIdFornecedor });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
