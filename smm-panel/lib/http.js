function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function endpoint(fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try { return await fn(req, res); } catch (e) {
      if (!e.status) console.error('Request failed:', e.message);
      return res.status(e.status || 500).json({ erro: e.status ? e.message : 'Erro interno. Tente novamente mais tarde.' });
    }
  };
}
function mutation(req) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) fail('Método não permitido', 405);
  if (!process.env.APP_URL) fail('APP_URL não configurada', 503);
  if ((req.headers.origin && req.headers.origin !== new URL(process.env.APP_URL).origin) || req.headers['sec-fetch-site'] === 'cross-site') fail('Origem não permitida', 403);
  if (!(req.headers['content-type'] || '').startsWith('application/json')) fail('Use application/json', 415);
}
function text(v, name, max = 200) { if (typeof v !== 'string' || !v.trim() || v.length > max) fail(name + ' inválido'); return v.trim(); }
function number(v, name, min, max, integer = false) {
  if (!['number', 'string'].includes(typeof v) || String(v).trim() === '') fail(name + ' inválido');
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) fail(name + ' inválido');
  return n;
}
function url(v, name = 'URL') {
  let u; try { u = new URL(text(v, name, 2048)); } catch { fail(name + ' inválida'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) fail(name + ' inválida');
  return u.href;
}
module.exports = { endpoint, fail, mutation, text, number, url };
