const { getApps, initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
function db() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_URL) throw new Error('FIREBASE_URL não configurada');
    initializeApp({ databaseURL: process.env.FIREBASE_URL, credential: process.env.FIREBASE_SERVICE_ACCOUNT ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) : applicationDefault() });
  }
  return getDatabase();
}
function key(value) {
  const v = String(value ?? '');
  if (!v || v.length > 128 || /[.#$\[\]/\u0000-\u001f\u007f]/.test(v)) { const e = new Error('Identificador inválido'); e.status = 400; throw e; }
  return v;
}
async function fbGet(path) { return (await db().ref(path).get()).val(); }
async function fbPatch(path, data) { await db().ref(path).update(data); return data; }
async function fbPut(path, data) { await db().ref(path).set(data); return data; }
async function fbPost(path, data) { const ref = db().ref(path).push(); await ref.set(data); return { name: ref.key }; }
async function fbTransaction(path, update) {
  const ref = path === '' ? db().ref() : db().ref(path);
  // Keep a listener until commit so conditionally aborted updates see server data,
  // including on a cold serverless instance (the initial transaction cache may be null).
  let listener;
  await new Promise((resolve, reject) => { listener = ref.on('value', resolve, reject); });
  try { const r = await ref.transaction(update, undefined, false); return { committed: r.committed, value: r.snapshot.val() }; }
  finally { ref.off('value', listener); }
}
async function fbQuery(path, field, value) { return (await db().ref(path).orderByChild(field).equalTo(value).get()).val(); }
module.exports = { fbGet, fbPatch, fbPut, fbPost, fbTransaction, fbQuery, key };

