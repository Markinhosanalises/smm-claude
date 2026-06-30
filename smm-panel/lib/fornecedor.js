// lib/fornecedor.js
// Centraliza as chamadas para a API do fornecedor (padrão JAP).
// A URL e a KEY do fornecedor NUNCA são expostas ao frontend — ficam
// salvas no Firebase (configuradas pelo admin) e só são lidas aqui,
// dentro das funções serverless (rodam no servidor da Vercel).

const { fbGet } = require('./firebase');

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

  const resp = await fetch(url, {
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

async function criarPedido({ service, link, quantity, runs, interval }) {
  const params = { action: 'add', service, link, quantity };
  if (runs) params.runs = runs;
  if (interval) params.interval = interval;
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
  listarServicos,
  criarPedido,
  statusPedido,
  statusPedidos,
  saldoFornecedor,
};
