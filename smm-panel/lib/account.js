const {fbGet,fbTransaction}=require('./firebase');
const {fail,text}=require('./http');
const auth=require('./auth');
function profile(s){const c=s.cliente;return{nome:c.nome||'',usuario:c.usuario||'',whatsapp:c.whatsapp||s.clienteId,role:c.role||'cliente',desconto:Number(c.desconto||0),criadoEm:c.criadoEm||null,senhaAlteradaEm:c.senhaAlteradaEm||null,apiAtiva:!!c.apiKeyHash};}
async function handle(req,res,s){
 if(req.method==='GET')return res.json(profile(s));
 const b=req.body||{};
 if(b.acao==='atualizar-perfil'){
  await auth.rateLimit(req,'account-profile',20,60000);
  const nome=text(b.nome,'Nome',100),version=Number(s.cliente.authVersion||0);
  const r=await fbTransaction('clientes/'+s.clienteId,c=>c&&!c.bloqueado&&Number(c.authVersion||0)===version?{...c,nome}:undefined);
  if(!r.committed)fail('Sua conta foi alterada. Entre novamente.',401);
  return res.json({ok:true,conta:profile({...s,cliente:r.value})});
 }
 if(b.acao!=='alterar-senha')fail('Ação inválida');
 await auth.rateLimit(req,'account-password',5,900000);
 const c=s.cliente,current=b.senhaAtual;
 if(typeof current!=='string'||!current||current.length>128)fail('Informe sua senha atual');
 if(typeof b.novaSenha!=='string'||b.novaSenha!==b.confirmacaoSenha)fail('A confirmação deve ser igual à nova senha');
 if(current===b.novaSenha)fail('Escolha uma senha diferente da atual');
 const valid=c.passwordHash?await auth.verifyPassword(current,c.passwordHash):!!c.senha&&auth.equal(current,c.senha);
 if(!valid)fail('Senha atual incorreta',403);
 const newHash=await auth.hashPassword(b.novaSenha),version=Number(c.authVersion||0),now=Date.now();
 if(!Number.isSafeInteger(version)||version<0||!Number.isSafeInteger(version+1))fail('Não foi possível atualizar a senha',409);
 const r=await fbTransaction('clientes/'+s.clienteId,latest=>{
  if(!latest||latest.bloqueado||Number(latest.authVersion||0)!==version||latest.passwordHash!==c.passwordHash||latest.senha!==c.senha)return;
  return{...latest,passwordHash:newHash,senha:null,authVersion:version+1,senhaAlteradaEm:now};
 });
 if(!r.committed)fail('Sua senha foi alterada em outra solicitação. Entre novamente.',409);
 await auth.logout(req,res);
 return res.json({ok:true,novoLoginNecessario:true});
}
module.exports={handle,profile};
