const policy=require('../lib/catalog-policy');
const { fbGet, fbQuery } = require('../lib/firebase');
const { endpoint, fail } = require('../lib/http');
const { digest, equal, rateLimit } = require('../lib/auth');
const { balanceCents } = require('../lib/wallet');
const { rate } = require('../lib/pricing');
const catalogText=require('../public/catalog-text');
const forms=require('../public/service-forms');
const { create, requestKey } = require('../lib/orders');
async function authenticate(req) {
  const header = req.headers.authorization || '';
  if (!/^Bearer fsx_[a-f0-9]{48}$/.test(header)) fail('Use Authorization: Bearer fsx_CHAVE',401);
  const hash = digest(header.slice(7));
  const idx = await fbGet('api_keys/' + hash);
  if (!idx || idx.revogada) fail('Chave inválida ou revogada',401);
  const customer = await fbGet('clientes/' + idx.clienteId);
  if (!customer || customer.bloqueado || !customer.apiKeyHash || !equal(customer.apiKeyHash, hash)) fail('Chave inválida ou revogada',401);
  return { id: idx.clienteId, customer };
}
module.exports = endpoint(async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Idempotency-Key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET','POST'].includes(req.method)) fail('Método não permitido',405);
  const action = req.query.action || req.body?.action;
  if (!action) return res.json({ api:'Fênix Social API',versao:'1.1',actions:['services','balance','status','add'] });
  const a = await authenticate(req);
  await rateLimit(req,'public-api',120,60000);
  if (action === 'services') {
    const [catalog, config] = await Promise.all([fbGet('catalogo'),fbGet('config')]);
    return res.json(Object.values(catalog || {}).filter(s=>s?.ativo&&!s.indisponivel&&!policy.reason(s)&&!catalogText.technical(s)&&forms.describe(s).supported).sort(catalogText.compare).map(s=>({
      service:s.idFornecedor,name:catalogText.present(s).nome,category:catalogText.present(s).categoria,type:s.tipo||'',
      billing:forms.isPackage(s)?'package':s.tipo==='Subscriptions'?'subscription':'per_1000',
      rate:rate(s,config||{},a.customer),min:s.min,max:s.max,refill:!!s.refill
    })));
  }
  if (action === 'balance') return res.json({balance:(balanceCents(await fbGet('carteiras/'+a.id))/100).toFixed(2),currency:'BRL'});
  if (action === 'status') {
    const id = req.query.order || req.body?.order;
    const items = await fbQuery('pedidos','clienteId',a.id);
    const found = Object.entries(items||{}).find(([key,p])=>p&&(key===id||p.numeroPedido===id));
    if (!found) fail('Pedido não encontrado',404);
    const p=await require('../lib/order-status').refresh(found[0], found[1]);
    return res.json({order:p.numeroPedido,status:p.status,charge:Number(p.valorTotal).toFixed(2),start_count:p.startCount||0,remains:p.restam||0,currency:'BRL'});
  }
  if (action === 'add') {
    if (req.method !== 'POST') fail('Use POST',405);
    const p = await create(a.id,a.customer,{...req.body,pagarComSaldo:true},requestKey(req));
    return res.json({order:p.numeroPedido,pedidoId:p.pedidoId,status:p.status,charge:p.valorTotal.toFixed(2),currency:'BRL'});
  }
  fail('Ação inválida');
});
module.exports.authenticate = authenticate;

