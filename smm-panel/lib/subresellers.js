const crypto=require('node:crypto');
const {fbGet,fbPut,fbQuery,fbTransaction,key}=require('./firebase');
const {digest,rateLimit}=require('./auth');
const {fail}=require('./http');
const {balanceCents}=require('./wallet');
function tokenHash(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('Convite inválido',404);return digest(token);}
async function inspect(token){
 const hash=tokenHash(token),invite=await fbGet('convites_revenda/'+hash),owner=invite&&await fbGet('clientes/'+invite.revendedorId);
 if(!invite||invite.status!=='ativo'||invite.expiraEm<=Date.now()||owner?.role!=='revendedor'||owner.bloqueado)fail('Convite inválido, expirado ou já utilizado. Peça um novo link à sua revenda.',410);
 return {hash,invite,owner};
}
async function publicInfo(req,res){await rateLimit(req,'subreseller-invite-read',60,60000);const found=await inspect(req.query.convite);return res.json({valido:true,nomeRevenda:found.owner.nome,expiraEm:found.invite.expiraEm});}
async function accept(req,res){
 await rateLimit(req,'subreseller-signup',5,60000);
 const found=await inspect(req.body.convite);
 const result=await require('../api/auth-cliente').register(req.body,undefined,'revendedor',0,found.hash);
 await require('./auth').createSession(res,result.clienteId);
 return res.json({...result,role:'revendedor'});
}
async function handle(req,res,s){
 if(s.cliente.role!=='revendedor')fail('Acesso negado',403);
 if(req.method==='GET'){
  const [children,invites]=await Promise.all([fbQuery('clientes','revendedorId',s.clienteId),fbQuery('convites_revenda','revendedorId',s.clienteId)]);
  const subrevendedores=await Promise.all(Object.entries(children||{}).filter(([,c])=>c?.role==='revendedor').map(async([id,c])=>({clienteId:id,nome:c.nome,usuario:c.usuario,whatsapp:c.whatsapp,saldo:balanceCents(await fbGet('carteiras/'+id))/100,criadoEm:c.criadoEm})));
  return res.json({subrevendedores,convites:Object.entries(invites||{}).filter(([,v])=>v).sort((a,b)=>b[1].criadoEm-a[1].criadoEm).slice(0,100).map(([id,v])=>({id,status:v.status==='ativo'&&v.expiraEm<=Date.now()?'expirado':v.status,criadoEm:v.criadoEm,expiraEm:v.expiraEm,utilizadoEm:v.utilizadoEm||null}))});
 }
 await rateLimit(req,'subreseller-invite-manage',20,60000);
 const b=req.body||{};
 if(b.acao==='revogar-convite-subrevenda'){
  const id=key(b.conviteId);let error;
  const r=await fbTransaction('convites_revenda/'+id,v=>{error=null;if(!v||v.revendedorId!==s.clienteId){error=['Convite não encontrado',404];return;}if(v.status==='utilizado'){error=['Convite já utilizado',409];return;}return{...v,status:'revogado'};});
  if(!r.committed)fail(...(error||['Falha ao revogar convite',409]));
  return res.json({ok:true});
 }
 if(b.acao!=='criar-convite-subrevenda')fail('Ação inválida');
 const token=crypto.randomBytes(32).toString('hex'),id=digest(token),now=Date.now();
 const record={revendedorId:s.clienteId,status:'ativo',criadoEm:now,expiraEm:now+7*86400000};
 await fbPut('convites_revenda/'+id,record);
 const url=new URL('/app.html',process.env.APP_URL);url.searchParams.set('convite',token);
 return res.json({ok:true,url:url.href,expiraEm:record.expiraEm});
}
module.exports={handle,publicInfo,accept,tokenHash};
