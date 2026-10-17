// lib/fornecedor.js
// Centraliza as chamadas para a API do fornecedor (padrão JAP).
// A URL e a KEY do fornecedor NUNCA são expostas ao frontend — ficam
// salvas no Firebase (configuradas pelo admin) e só são lidas aqui,
// dentro das funções serverless (rodam no servidor da Vercel).

const { fbGet } = require('./firebase');
function validateProviderUrl(value) {
  const u = new URL(value);
  const hosts = (process.env.FORNECEDOR_ALLOWED_HOSTS || 'measmm.com').split(',').map(s=>s.trim().toLowerCase());
  if(u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !hosts.includes(u.hostname.toLowerCase())) throw new Error('URL do fornecedor não autorizada');
  return u.href;
}

async function getConfigFornecedor() {
  const config = await fbGet('config/fornecedor');
  if (!config || !config.url || !config.key) {
    throw new Error('Fornecedor não configurado. Vá no painel admin e cadastre a URL e a KEY da API.');
  }
  return config; // { url, key }
}

async function chamarFornecedor(params) {
  const { url, key } = await getConfigFornecedor();

  const body = new URLSearchParams({ key, ...params });

  const resp = await fetch(validateProviderUrl(url), {
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    throw new Error(`Fornecedor retornou status ${resp.status}`);
  }

  const data = await resp.json();
  return data;
}

async function listarServicos() {
  return chamarFornecedor({ action: 'services' });
}

async function criarPedido(input) {
  const params={action:'add'};
  for(const field of ['service','link','quantity','runs','interval','comments','keywords','usernames','hashtag','username','answer_number','groups','min','max','posts','old_posts','delay','expiry']) {
    if(input[field]!==undefined&&input[field]!==null&&input[field]!=='')params[field]=input[field];
  }
  return chamarFornecedor(params);
}

async function statusPedido(orderId) {
  return chamarFornecedor({ action: 'status', order: orderId });
}

async function statusPedidos(orderIds) {
  return chamarFornecedor({ action: 'status', orders: orderIds.join(',') });
}

async function saldoFornecedor() {
  return chamarFornecedor({ action: 'balance' });
}

module.exports = {
  validateProviderUrl,
  listarServicos,
  criarPedido,
  statusPedido,
  statusPedidos,
  saldoFornecedor,
};

