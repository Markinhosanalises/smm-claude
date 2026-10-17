const { fbGet, fbPatch, fbQuery, key } = require('./firebase');
const { session, requireAdmin, rateLimit } = require('./auth');
const { mutation, fail, number } = require('./http');
const { balanceCents } = require('./wallet');
const safe = (id,c,w) => ({ clienteId:id,whatsapp:c.whatsapp||id,nome:c.nome||'',usuario:c.usuario||'',desconto:c.desconto||0,saldo:balanceCents(w)/100,criadoEm:c.criadoEm });
module.exports = async (req,res) => {
  const admin = await session(req,'admin',true);
  if(req.method === 'GET') {
    if(admin && req.query.todos === '1') {
      const [cs,ws] = await Promise.all([fbGet('clientes'),fbGet('carteiras')]);
      return res.json({revendedores:Object.entries(cs||{}).filter(([,c])=>c?.role==='revendedor').map(([id,c])=>safe(id,c,ws?.[id]))});
    }
    const s = await session(req);
    if(s.cliente.role !== 'revendedor') fail('Acesso negado',403);
    if(req.query.action==='pix-manual')return require('./manual-pix').reseller(req,res,s);
    if(req.query.action === 'clientes') {
      const cs = await fbQuery('clientes','revendedorId',s.clienteId);
      return res.json({clientes:Object.entries(cs||{}).map(([id,c])=>({clienteId:id,nome:c.nome,usuario:c.usuario,whatsapp:c.whatsapp}))});
    }
    return res.json(safe(s.clienteId,s.cliente,await fbGet('carteiras/'+s.clienteId)));
  }
  mutation(req);
  const b=req.body||{};
  if(admin && !['criar-cliente','configurar-pix-manual','aprovar-pix-manual','rejeitar-pix-manual','creditar-cliente-manual'].includes(b.acao)) {
    if(b.acao==='set-desconto') {
      const id=key(b.clienteId);
      const c=await fbGet('clientes/'+id);
      if(c?.role!=='revendedor') fail('Revendedor não encontrado',404);
      await fbPatch('clientes/'+id,{desconto:number(b.desconto,'Desconto',0,90)});
      return res.json({ok:true});
    }
    const discount=number(b.desconto||0,'Desconto',0,90);
    const result=await require('../api/auth-cliente').register(b,undefined,'revendedor',discount);
    return res.json(result);
  }
  const s=await session(req);
  if(['configurar-pix-manual','aprovar-pix-manual','rejeitar-pix-manual','creditar-cliente-manual'].includes(b.acao))return require('./manual-pix').reseller(req,res,s);
  if(s.cliente.role!=='revendedor'||b.acao!=='criar-cliente') fail('Acesso negado',403);
  await rateLimit(req,'reseller-register',20,60000);
  const result=await require('../api/auth-cliente').register({nome:b.nomeCliente,whatsapp:b.whatsappCliente,usuario:b.usuarioCliente,senha:b.senhaCliente,origem:'revendedor'},s.clienteId);
  return res.json(result);
};
