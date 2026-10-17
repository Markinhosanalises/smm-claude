const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { fbGet, fbPut, fbPatch, fbTransaction, key } = require('./firebase');
const { fail } = require('./http');
const digest = v => crypto.createHash('sha256').update(String(v)).digest('hex');
function equal(a, b) { return crypto.timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b))); }
async function makeHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt$' + salt + '$' + (await scrypt(password, salt, 64)).toString('hex');
}
async function hashPassword(p) {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) fail('Senha deve ter de 8 a 128 caracteres');
  return makeHash(p);
}
async function verifyPassword(p, hash) {
  if (typeof p !== 'string' || p.length > 128 || typeof hash !== 'string') return false;
  const [type, salt, expected] = hash.split('$');
  if (type !== 'scrypt' || !salt || !expected) return false;
  return equal((await scrypt(p, salt, 64)).toString('hex'), expected);
}
async function loginPassword(id, password) {
  const c = await fbGet('clientes/' + key(id));
  if (!c || c.bloqueado || typeof password !== 'string' || password.length > 128) fail('Usuário ou senha incorretos', 401);
  if (c.passwordHash) {
    if (!await verifyPassword(password, c.passwordHash)) fail('Usuário ou senha incorretos', 401);
  } else {
    if (!c.senha || !equal(password, c.senha)) fail('Usuário ou senha incorretos', 401);
    const migrated=await makeHash(password);
    const r=await fbTransaction('clientes/'+id,current=>current&&!current.bloqueado&&!current.passwordHash&&current.senha===c.senha&&Number(current.authVersion||0)===Number(c.authVersion||0)?{...current,passwordHash:migrated,senha:null}:undefined);
    if(!r.committed)fail('Sua conta foi alterada. Entre novamente.',401);
    return r.value;
  }
  return c;
}
async function rateLimit(req, bucket, limit = 10, windowMs = 900000) {
  const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const slot = Math.floor(Date.now() / windowMs);
  const r = await fbTransaction('rate_limits/' + digest(bucket + ':' + ip + ':' + slot), current => {
    const c = current || { count: 0, expiresAt: (slot + 2) * windowMs };
    if (c.count >= limit) return;
    return { ...c, count: c.count + 1 };
  });
  if (!r.committed) fail('Muitas tentativas. Aguarde e tente novamente.', 429);
}
function cookieName(role) { return role === 'admin' ? 'smm_admin' : 'smm_session'; }
function cookie(req, role) {
  const prefix = cookieName(role) + '=';
  return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(prefix))?.slice(prefix.length);
}
async function createSession(res, id, role = 'cliente', expectedVersion) {
  const version=role==='admin'?0:Number((await fbGet('clientes/'+key(id)))?.authVersion||0);
  if(expectedVersion!==undefined&&version!==expectedVersion)fail('Sua senha foi alterada. Entre novamente.',401);
  const token = crypto.randomBytes(32).toString('hex');
  const maxAge = role === 'admin' ? 3600 : 86400;
  await fbPut('sessions/' + digest(token), { clienteId: id, role, authVersion:version, expiresAt: Date.now() + maxAge * 1000 });
  res.setHeader('Set-Cookie', cookieName(role) + '=' + token + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + maxAge);
}
async function session(req, role = 'cliente', optional = false) {
  const token = cookie(req, role);
  const s = token && /^[a-f0-9]{64}$/.test(token) ? await fbGet('sessions/' + digest(token)) : null;
  if (!s || s.expiresAt <= Date.now() || (role === 'admin' && s.role !== 'admin')) {
    if (optional) return null;
    fail('Faça login novamente', 401);
  }
  if (s.role !== 'admin') {
    const c = await fbGet('clientes/' + key(s.clienteId));
    if (!c || c.bloqueado) fail('Conta indisponível', 401);
    if(Number(s.authVersion||0)!==Number(c.authVersion||0))fail('Sua senha foi alterada. Entre novamente.',401);
    return { ...s, cliente: c };
  }
  return s;
}
async function requireAdmin(req) { return session(req, 'admin'); }
async function logout(req, res, role = 'cliente') {
  const token = cookie(req, role);
  if (token && /^[a-f0-9]{64}$/.test(token)) await fbPut('sessions/' + digest(token), null);
  res.setHeader('Set-Cookie', cookieName(role) + '=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
}
module.exports = { digest, equal, hashPassword, verifyPassword, loginPassword, rateLimit, createSession, session, requireAdmin, logout };
