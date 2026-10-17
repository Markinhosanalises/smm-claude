const { fbGet, fbPost, fbQuery, fbTransaction, fbPut, key } = require('../lib/firebase');
const { endpoint, mutation, fail, text, number } = require('../lib/http');
const { session, requireAdmin, rateLimit, digest } = require('../lib/auth');
const assistant=require('../lib/support-assistant');
function operation(value){if(value===undefined)return null;if(typeof value!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(value))fail('Identificador de envio inválido');return value;}
async function safeRespond(id){try{await assistant.respond(id);}catch{ /* The durable ticket is still available to the team or a safe retry. */ }}
module.exports = endpoint(async (req, res) => {
 const admin = await session(req, 'admin', true);
 if(req.method==='GET'){
  if(req.query.action==='configuracao-assistente'){
   await requireAdmin(req);const config=await fbGet('config/suporteIA')||{},usage=await fbGet('suporte_uso/'+new Date().toISOString().slice(0,10));
   return res.json({ativo:config.ativo!==false,usarIA:config.usarIA===true,chaveConfigurada:!!(process.env.OPENAI_API_KEY||config.chave),chaveAmbiente:!!process.env.OPENAI_API_KEY,modelo:'gpt-4.1-mini',limiteDiario:config.limiteDiario||50,consultasHoje:Number(usage?.chamadas||0)});
  }
  const s=admin||await session(req);
  if(!admin&&req.query.clienteId&&req.query.clienteId!==s.clienteId)fail('Acesso negado',403);
  const items=admin?await fbGet('tickets'):await fbQuery('tickets','clienteId',s.clienteId);
  return res.json({tickets:Object.entries(items||{}).filter(([,t])=>t&&(admin||t.clienteId===s.clienteId)).map(([id,t])=>assistant.publicTicket(id,t)).sort((a,b)=>b.criadoEm-a.criadoEm)});
 }
 mutation(req);if(req.method!=='POST')fail('Método não permitido',405);
 const b=req.body||{};
 if(b.action==='configurar-assistente'){
  await requireAdmin(req);await rateLimit(req,'support-config',10,60000);
  const prior=await fbGet('config/suporteIA')||{};
  const config={...prior,ativo:b.ativo!==false,usarIA:b.usarIA===true,limiteDiario:number(b.limiteDiario??50,'Limite diário',1,500,true),atualizadoEm:Date.now()};
  if(b.removerChave===true)delete config.chave;
  if(b.chave){const secret=text(b.chave,'Chave',512);if(!/^sk-[a-zA-Z0-9_-]{20,500}$/.test(secret))fail('Chave da OpenAI inválida');config.chave=secret;}
  if(config.usarIA&&!process.env.OPENAI_API_KEY&&!config.chave)fail('Cadastre sua chave da OpenAI para ativar a classificação por IA.',409);
  await fbPut('config/suporteIA',config);return res.json({ok:true});
 }
 if(b.action==='testar-assistente'){
  await requireAdmin(req);await rateLimit(req,'support-test',3,60000);const config=await fbGet('config/suporteIA')||{};
  if(!config.usarIA||!(process.env.OPENAI_API_KEY||config.chave))fail('Ative a IA e configure a chave primeiro.',409);
  const result=await require('../lib/support-ai').classify('Como faço para acompanhar o andamento do meu pedido?',{pedido:{status:'executando'},fornecedorConsultado:true},config);
  return res.json({ok:result.modo==='ia',modo:result.modo,motivo:result.motivo||null});
 }
 if(b.ticketId){
  const id=key(b.ticketId);
  if(admin){
   await requireAdmin(req);
   const status=b.status;if(status!==undefined&&!['aberto','resolvido'].includes(status))fail('Status inválido');
   const answer=typeof b.resposta==='string'&&b.resposta.trim()?text(b.resposta,'Resposta',5000):null;
   if(!answer&&!status&&!['assumir','retomar-automatico'].includes(b.action))fail('Informe uma ação ou uma resposta.');
   const result=await fbTransaction('tickets/'+id,current=>{
    if(!current)return;
    const history=assistant.messages(current),now=Date.now();
    if(answer)history.push({autor:'equipe',texto:answer,criadoEm:now});
    return{...current,...(status?{status}:{}),...(answer?{resposta:answer,respondidoEm:now,modoResposta:'humano'}:{}),mensagens:history.slice(-80),automacao:null,humanoAtivo:b.action!=='retomar-automatico',atendimento:status==='resolvido'?'resolvido':answer||b.action==='retomar-automatico'?'aguardando_cliente':'aguardando_equipe',revisaoRespondida:Number(current.revisao||1)};
   });
   if(!result.committed)fail('Ticket não encontrado',404);
   return res.json({ok:true});
  }
  const s=await session(req);await rateLimit(req,'ticket-reply',10,60000);
  const prior=await fbGet('tickets/'+id);if(!prior||prior.clienteId!==s.clienteId)fail('Ticket não encontrado',404);
  if(!['continuar','pedir-humano','reconsultar'].includes(b.action))fail('Ação inválida',403);
  const message=b.action==='continuar'?text(b.mensagem,'Mensagem',5000):null,op=operation(b.requestId);
  const update=await fbTransaction('tickets/'+id,current=>{
   if(!current||current.clienteId!==s.clienteId)return;
   if(op&&(current.operacoesCliente||[]).includes(op))return current;
   const history=assistant.messages(current),now=Date.now();
   if(message&&history.length>=60)fail('Conversa longa. Abra um novo ticket para continuar.',409);
   if(message)history.push({autor:'cliente',texto:message,criadoEm:now});
   if(b.action==='reconsultar')return current;
   return{...current,status:'aberto',mensagens:history,revisao:Number(current.revisao||1)+(message?1:0),automacao:null,atualizadoEm:now,atendimento:current.humanoAtivo||b.action==='pedir-humano'?'aguardando_equipe':'aguardando',humanoAtivo:!!current.humanoAtivo||b.action==='pedir-humano',operacoesCliente:[...(current.operacoesCliente||[]),...(op?[op]:[])].slice(-80)};
  });
  if(!update.committed)fail('Ticket não encontrado',404);
  if(b.action!=='pedir-humano')await safeRespond(id);
  return res.json({ok:true,ticket:assistant.publicTicket(id,await fbGet('tickets/'+id))});
 }
 const s=await session(req);await rateLimit(req,'ticket',10,60000);
 const pedidoId=b.pedidoId?key(b.pedidoId):null;
 if(pedidoId){const p=await fbGet('pedidos/'+pedidoId);if(!p||p.clienteId!==s.clienteId)fail('Pedido não encontrado',404);}
 const message=text(b.mensagem,'Mensagem',5000),op=operation(b.requestId),now=Date.now();
 const ticket={clienteId:s.clienteId,nome:s.cliente.nome||'',whatsapp:s.cliente.whatsapp||'',mensagem:message,pedidoId,status:'aberto',criadoEm:now,revisao:1,revisaoRespondida:0,humanoAtivo:false,atendimento:'aguardando',mensagens:[{autor:'cliente',texto:message,criadoEm:now}]};
 let id;
 if(op){id=digest('ticket:'+s.clienteId+':'+op);const r=await fbTransaction('tickets/'+id,current=>current||ticket);if(r.value.mensagem!==message||(r.value.pedidoId||null)!==pedidoId)fail('Identificador de envio já usado com outra pergunta.',409);}
 else id=(await fbPost('tickets',ticket)).name;
 await safeRespond(id);
 return res.json({ticketId:id,...assistant.publicTicket(id,await fbGet('tickets/'+id))});
});
