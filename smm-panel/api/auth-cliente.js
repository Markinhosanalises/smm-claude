const crypto = require('node:crypto');
const { fbGet, fbPut, fbPatch, fbTransaction, key } = require('../lib/firebase');
const { endpoint, mutation, fail, text, number } = require('../lib/http');
const auth = require('../lib/auth');
function whatsapp(v) { const id = String(v || '').replace(/\D/g, ''); if (!/^\d{8,15}$/.test(id)) fail('WhatsApp inválido'); return id; }
function usuario(v) { const u = text(v, 'Usuário', 40).toLowerCase(); if (!/^[a-z0-9_]{3,40}$/.test(u)) fail('Usuário deve ter 3 a 40 letras, números ou _'); return u; }
async function register(body, owner, role = 'cliente', discount = 0) {
  const id = whatsapp(body.whatsapp), user = usuario(body.usuario);
  const c = { nome: text(body.nome, 'Nome', 100), whatsapp: id, usuario: user, passwordHash: await auth.hashPassword(body.senha), origem: String(body.origem || 'site').slice(0, 80), criadoEm: Date.now(), role, desconto: discount, ...(owner ? { revendedorId: owner } : {}) };
  const r = await fbTransaction('', root => {
    root = root || {};
    if (root.clientes?.[id] || root.usuarios?.[user]) return;
    return { ...root, clientes: { ...root.clientes, [id]: c }, usuarios: { ...root.usuarios, [user]: { whatsapp: id } } };
  });
  if (!r.committed) fail('WhatsApp ou usuário já cadastrado', 409);
  return { clienteId: id, nome: c.nome, usuario: user };
}
module.exports = endpoint(async (req, res) => {
  if (req.query.route === 'revendedor') return require('../lib/resellers')(req, res);
  if (req.method === 'GET') {
    if (req.query.acao === 'admin-session') { await auth.requireAdmin(req); return res.json({ ok: true }); }
    const s = await auth.session(req);
    return res.json({ clienteId: s.clienteId, nome: s.cliente.nome, usuario: s.cliente.usuario, role: s.cliente.role || 'cliente', desconto: s.cliente.desconto || 0 });
  }
  mutation(req);
  const b = req.body || {}, acao = b.acao;
  if (acao === 'admin-login') {
    await auth.rateLimit(req, 'admin-login', 5);
    const secret = process.env.ADMIN_PIN;
    if (!secret || secret.length < 12 || secret.startsWith('SUBSTITUA_')) fail('Configure ADMIN_PIN com pelo menos 12 caracteres', 503);
    if (typeof b.pin !== 'string' || !auth.equal(b.pin, secret)) fail('Credencial inválida', 401);
    await auth.createSession(res, 'admin', 'admin');
    return res.json({ ok: true });
  }
  if (acao === 'logout' || acao === 'admin-logout') {
    await auth.logout(req, res, acao === 'admin-logout' ? 'admin' : 'cliente');
    return res.json({ ok: true });
  }
  if (acao === 'set-desconto') {
    await auth.requireAdmin(req);
    const id = key(b.clienteId), desconto = number(b.desconto, 'Desconto', 0, 90);
    if (!await fbGet('clientes/' + id)) fail('Cliente não encontrado', 404);
    await fbPatch('clientes/' + id, { desconto });
    return res.json({ ok: true });
  }
  if (acao === 'cadastro') {
    await auth.rateLimit(req, 'cadastro', 5);
    const result = await register(b);
    await auth.createSession(res, result.clienteId);
    return res.json({ ...result, role: 'cliente' });
  }
  if (acao === 'login') {
    await auth.rateLimit(req, 'login');
    let id;
    if (b.whatsapp) id = whatsapp(b.whatsapp);
    else { const idx = await fbGet('usuarios/' + usuario(b.usuario)); id = idx?.whatsapp; }
    if (!id) fail('Usuário ou senha incorretos', 401);
    const c = await auth.loginPassword(id, b.senha);
    await auth.createSession(res, id);
    return res.json({ clienteId: id, nome: c.nome || '', usuario: c.usuario || '', role: c.role || 'cliente' });
  }
  if (['gerar-chave', 'revogar-chave'].includes(acao)) {
    const s = await auth.session(req);
    await auth.rateLimit(req, 'api-key');
    await auth.loginPassword(s.clienteId, b.senha);
    const newKey = acao === 'gerar-chave' ? 'fsx_' + crypto.randomBytes(24).toString('hex') : null;
    const r = await fbTransaction('clientes/' + s.clienteId, c => c ? { ...c, apiKeyHash: newKey ? auth.digest(newKey) : null, apiKey: null } : undefined);
    if (!r.committed) fail('Conta indisponível', 409);
    // Old plain keys may remain in the index, but authentication also checks the current hash.
    if (newKey) await fbPut('api_keys/' + auth.digest(newKey), { clienteId: s.clienteId, criadoEm: Date.now() });
    return res.json({ ok: true, ...(newKey ? { chave: newKey } : {}) });
  }
  fail('Ação inválida');
});
module.exports.register = register;

