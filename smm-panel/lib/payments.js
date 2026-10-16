const crypto = require('node:crypto');
const { fbGet, fbPatch, fbTransaction, key } = require('./firebase');
const { fail } = require('./http');
const { change } = require('./wallet');
const { dispatch } = require('./orders');
async function token() {
  const c = await fbGet('config');
  const t = process.env.MP_ACCESS_TOKEN || c?.mercadopago?.accessToken;
  if (!t) fail('Mercado Pago não configurado', 503);
  return t;
}
async function mp(path, options = {}) {
  const response = await fetch('https://api.mercadopago.com/v1/payments' + path, {
    ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token(), ...options.headers },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) fail('Não foi possível consultar ou gerar o pagamento', 502);
  return response.json();
}
function verifySignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) fail('Webhook não configurado', 503);
  const id = req.query['data.id'];
  const requestId = req.headers['x-request-id'];
  const parts = String(req.headers['x-signature'] || '').split(',').map(s => s.trim().split('='));
  const ts = parts.find(([k]) => k === 'ts')?.[1], signature = parts.find(([k]) => k === 'v1')?.[1];
  if (typeof id !== 'string' || !/^[a-zA-Z0-9]+$/.test(id) || typeof requestId !== 'string' || !/^\d{10,13}$/.test(ts || '') || !/^[a-fA-F0-9]{64}$/.test(signature || '')) fail('Assinatura inválida', 401);
  const timestamp = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);
  if (Math.abs(Date.now() - timestamp) > 300000) fail('Notificação expirada', 401);
  const expected = crypto.createHmac('sha256', secret).update('id:' + id.toLowerCase() + ';request-id:' + requestId + ';ts:' + ts + ';').digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) fail('Assinatura inválida', 401);
  if (req.body?.data?.id !== undefined && String(req.body.data.id).toLowerCase() !== id.toLowerCase()) fail('Identificador de pagamento divergente', 400);
  return id;
}
async function createPix(reference, record, path) {
  if (record.paymentId) {
    const existing = await mp('/' + encodeURIComponent(record.paymentId));
    return pixResult(existing, record.valorTotal ?? record.valor);
  }
  const amount = record.valorTotal ?? record.valor;
  const appUrl = process.env.APP_URL;
  if (!appUrl || new URL(appUrl).protocol !== 'https:') fail('Configure APP_URL com HTTPS', 503);
  const payment = await mp('', {
    method: 'POST', headers: { 'X-Idempotency-Key': reference },
    body: JSON.stringify({
      transaction_amount: amount, description: record.nomeServico || 'Recarga de saldo',
      payment_method_id: 'pix', payer: { email: 'cliente_' + record.clienteId + '@engaja.app' },
      external_reference: reference, notification_url: new URL('/api/pagamento?action=webhook', appUrl).href
    })
  });
  if (!payment.id) fail('Resposta inválida do Mercado Pago', 502);
  await fbPatch(path, { paymentId: payment.id, pixStatus: payment.status });
  return pixResult(payment, amount);
}
function pixResult(payment, amount) {
  const pix = payment.point_of_interaction?.transaction_data || {};
  return { paymentId: payment.id, qrCode: pix.qr_code || null, qrCodeBase64: pix.qr_code_base64 || null, valorTotal: amount, valor: amount, status: payment.status };
}
async function confirmPayment(paymentId) {
  if (!/^\d+$/.test(String(paymentId))) fail('Pagamento inválido');
  const p = await mp('/' + paymentId);
  if (p.status !== 'approved') return { ok: true, status: p.status };
  if (p.currency_id !== 'BRL') fail('Moeda divergente', 409);
  const ref = key(p.external_reference);
  const deposit = ref.startsWith('dep_');
  const path = (deposit ? 'depositos/' : 'pedidos/') + ref;
  const record = await fbGet(path);
  if (!record) fail('Referência não encontrada', 404);
  if (!record.paymentId) fail('Pagamento ainda não vinculado. Tente novamente.', 503);
  if (String(record.paymentId) !== String(p.id) || Math.round(Number(p.transaction_amount) * 100) !== (record.valorCentavos ?? Math.round(Number(record.valorTotal ?? record.valor) * 100))) fail('Pagamento não corresponde à cobrança', 409);
  if (deposit) {
    await change(record.clienteId, record.valorCentavos ?? Math.round(record.valor * 100), 'deposit_' + ref);
    await fbPatch(path, { status: 'confirmado', confirmedEm: Date.now() });
    return { ok: true };
  }
  if (record.pagamento !== 'pix') fail('Pedido não utiliza PIX', 409);
  await fbTransaction(path, current => current?.status === 'aguardando_pagamento' ? { ...current, status: 'pago', pagoEm: Date.now(), workflowVersion: 2, valorCentavos: current.valorCentavos ?? Math.round(Number(current.valorTotal) * 100) } : undefined);
  await dispatch(ref);
  return { ok: true };
}
async function refundPix(id, record) {
  if (!record.paymentId) fail('Pedido sem pagamento vinculado para estorno', 409);
  await fbPatch('pedidos/' + id, { status: 'estorno_pix_pendente' });
  const result = await mp('/' + encodeURIComponent(record.paymentId) + '/refunds', {
    method: 'POST', headers: { 'X-Idempotency-Key': 'refund_' + id },
    body: JSON.stringify({ amount: record.valorTotal })
  });
  if (!result.id || result.status !== 'approved') fail('Estorno pendente de confirmação no Mercado Pago', 503);
  await fbPatch('pedidos/' + id, { status: 'estornado', estornadoEm: Date.now(), refundId: result.id });
}
module.exports = { verifySignature, createPix, confirmPayment, refundPix };
