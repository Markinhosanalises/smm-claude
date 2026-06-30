// lib/firebase.js
// Helper REST para o Firebase Realtime Database.
// Usa sempre PATCH (nunca PUT) pra updates parciais, seguindo o mesmo
// padrão dos outros projetos.
//
// Configure a variável de ambiente FIREBASE_URL na Vercel, ex:
// https://seu-projeto-default-rtdb.firebaseio.com

const FIREBASE_URL = process.env.FIREBASE_URL;

function checkUrl() {
  if (!FIREBASE_URL) {
    throw new Error('FIREBASE_URL não configurada nas variáveis de ambiente da Vercel.');
  }
}

async function fbGet(path) {
  checkUrl();
  const resp = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!resp.ok) throw new Error(`Firebase GET falhou (${resp.status}) em ${path}`);
  return resp.json();
}

async function fbPatch(path, data) {
  checkUrl();
  const resp = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Firebase PATCH falhou (${resp.status}) em ${path}`);
  return resp.json();
}

async function fbPut(path, data) {
  checkUrl();
  const resp = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Firebase PUT falhou (${resp.status}) em ${path}`);
  return resp.json();
}

async function fbPost(path, data) {
  checkUrl();
  const resp = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!resp.ok) throw new Error(`Firebase POST falhou (${resp.status}) em ${path}`);
  return resp.json(); // { name: "-NxYz..." } -> id gerado
}

module.exports = { fbGet, fbPatch, fbPut, fbPost };
