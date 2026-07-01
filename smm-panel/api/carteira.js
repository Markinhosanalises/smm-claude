// api/carteira.js
// Gerencia o saldo (carteira) do cliente.
//
//   GET  ?clienteId=X          -> saldo atual do cliente
//   GET  ?pin=ADMIN&todos=1    -> lista saldo de todos os clientes (admin)
//   POST { clienteId, valor }  -> gera PIX pra depositar saldo
//   POST { pin, clienteId, valor, creditar:true } -> admin credita saldo manualmente

const { fbGet, fbPatch } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

async function getAccessToken() {
  const config = await fbGet('config');
  const token = config?.mercadopago?.accessToken;
  if (!token) throw new Error('Access Token do Mercado Pago não configurado.');
  return token;
}

// Debita saldo do cliente — usado internamente pelo order.js
async function debitarSaldo(clienteId, valor) {
  const carteira = (await fbGet(`carteiras/${clienteId}`)) || { saldo: 0 };
  const saldoAtual = Number(carteira.saldo || 0);
  if (saldoAtual < valor) throw new Error('Saldo insuficiente');
  const novoSaldo = Math.round((saldoAtual - valor) * 100) / 100;
  await fbPatch(`carteiras/${clienteId}`, { saldo: novoSaldo });
  return novoSaldo;
}

// Credita saldo do cliente — usado pelo webhook e pelo admin
async function creditarSaldo(clienteId, valor) {
  const carteira = (await fbGet(`carteiras/${clienteId}`)) || { saldo: 0 };
  const saldoAtual = Number(carteira.saldo || 0);
  const novoSaldo = Math.round((saldoAtual + valor) * 100) / 100;
  await fbPatch(`carteiras/${clienteId}`, {
    saldo: novoSaldo,
    ultimoCredito: Date.now(),
  });
  return novoSaldo;
}

module.exports = async (req, res) => {
  // ===== GET saldo =====
  if (req.method === 'GET') {
    const { clienteId, pin, todos } = req.query;

    // admin: lista todos os clientes com saldo
    if (pin === ADMIN_PIN && todos === '1') {
      const [carteiras, clientes] = await Promise.all([
        fbGet('carteiras').catch(() => ({})),
        fbGet('clientes').catch(() => ({})),
      ]);
      const lista = Object.entries(carteiras || {}).map(([id, c]) => ({
        clienteId: id,
        nome: clientes?.[id]?.nome || id,
        saldo: c.saldo || 0,
        ultimoCredito: c.ultimoCredito || null,
      }));
      return res.status(200).json({ clientes: lista });
    }

    // cliente: próprio saldo
    if (clienteId) {
      const carteira = (await fbGet(`carteiras/${clienteId}`)) || { saldo: 0 };
      return res.status(200).json({ saldo: Number(carteira.saldo || 0) });
    }

    return res.status(400).json({ erro: 'clienteId ou pin+todos são obrigatórios' });
  }

  if (req.method === 'POST') {
    const { pin, clienteId, valor, creditar } = req.body || {};

    // admin: creditar saldo manualmente
    if (pin === ADMIN_PIN && creditar && clienteId) {
      const novoSaldo = await creditarSaldo(clienteId, Number(valor));
      return res.status(200).json({ ok: true, novoSaldo });
    }

    // cliente: gerar PIX pra depositar saldo
    if (!clienteId || !valor) {
      return res.status(400).json({ erro: 'clienteId e valor são obrigatórios' });
    }

    const valorNum = Number(valor);
    if (valorNum < 5) {
      return res.status(400).json({ erro: 'Valor mínimo de depósito é R$ 5,00' });
    }

    try {
      const accessToken = await getAccessToken();
      const config = await fbGet('config');
      const appUrl = (config?.appUrl || '').replace(/\/$/, '');

      const depositoId = `dep_${clienteId}_${Date.now()}`;

      const body = {
        transaction_amount: valorNum,
        description: `Recarga de saldo - ${clienteId}`,
        payment_method_id: 'pix',
        payer: {
          email: `cliente_${clienteId}@engaja.app`,
        },
        external_reference: depositoId,
        notification_url: appUrl ? `${appUrl}/api/carteira?action=webhook&clienteId=${clienteId}&valor=${valorNum}` : undefined,
      };

      if (!appUrl) delete body.notification_url;

      const resp = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': depositoId,
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`MP erro ${resp.status}: ${data.message || JSON.stringify(data)}`);

      const pixData = data.point_of_interaction?.transaction_data;

      // salva o depósito pendente no Firebase pra confirmar depois
      await fbPatch(`depositos/${depositoId}`, {
        clienteId,
        valor: valorNum,
        paymentId: data.id,
        status: 'pendente',
        criadoEm: Date.now(),
      });

      return res.status(200).json({
        depositoId,
        paymentId: data.id,
        qrCode: pixData?.qr_code,
        qrCodeBase64: pixData?.qr_code_base64,
        valor: valorNum,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // webhook do MP confirmando depósito — recebe POST igual ao webhook de pagamento
  if (req.method === 'POST' && req.query.action === 'webhook') {
    try {
      const { action, data } = req.body || {};
      if (action !== 'payment.updated' || !data?.id) {
        return res.status(200).json({ ok: true });
      }

      const accessToken = await getAccessToken();
      const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const payment = await paymentResp.json();

      if (payment.status !== 'approved') {
        return res.status(200).json({ ok: true, status: payment.status });
      }

      // external_reference tem o formato "dep_CLIENTEID_TIMESTAMP"
      const extRef = payment.external_reference || '';
      if (!extRef.startsWith('dep_')) {
        return res.status(200).json({ ok: true }); // não é depósito de saldo
      }

      // busca o depósito pendente no Firebase
      const deposito = await fbGet(`depositos/${extRef}`).catch(() => null);
      if (!deposito || deposito.status === 'confirmado') {
        return res.status(200).json({ ok: true }); // já processado
      }

      // credita o saldo
      const novoSaldo = await creditarSaldo(deposito.clienteId, deposito.valor);

      // marca o depósito como confirmado
      await fbPatch(`depositos/${extRef}`, {
        status: 'confirmado',
        confirmedEm: Date.now(),
        paymentId: payment.id,
      });

      return res.status(200).json({ ok: true, novoSaldo });
    } catch (err) {
      console.error('Webhook carteira erro:', err.message);
      return res.status(500).json({ erro: err.message });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};

module.exports.debitarSaldo = debitarSaldo;
module.exports.creditarSaldo = creditarSaldo;
