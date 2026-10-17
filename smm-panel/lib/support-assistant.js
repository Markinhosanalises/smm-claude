const crypto=require('node:crypto');
const { fbGet, fbQuery, fbTransaction, key }=require('./firebase');
const { statusPedido }=require('./fornecedor');
const { classify, basicIntent }=require('./support-ai');
const catalog=require('../public/catalog-text');
const labels={aguardando_pagamento:'Aguardando pagamento',executando:'Em andamento',concluido:'Concluído',cancelado:'Cancelado',parcial:'Concluído parcialmente',erro_fornecedor:'Recusado pelo fornecedor',pago:'Pago, aguardando envio',enviando:'Enviando ao fornecedor',processando_saldo:'Processando saldo',revisao_fornecedor:'Em conferência',estorno_pix_pendente:'Estorno PIX pendente',estornado:'Estornado',saldo_insuficiente:'Saldo insuficiente'};
const providerLabels={'Pending':'Pendente','In progress':'Em andamento','Processing':'Processando','Completed':'Concluído','Canceled':'Cancelado','Cancelled':'Cancelado','Partial':'Parcial','Error':'Erro','Fail':'Falha'};
function messages(t){return Array.isArray(t?.mensagens)?t.mensagens.filter(Boolean):Object.values(t?.mensagens||{}).filter(Boolean);}
function publicTicket(id,t){return{id,clienteId:t.clienteId,nome:t.nome||'',whatsapp:t.whatsapp||'',mensagem:t.mensagem,pedidoId:t.pedidoId||null,status:t.status,criadoEm:t.criadoEm,resposta:t.resposta||'',respondidoEm:t.respondidoEm||null,mensagens:messages(t),humanoAtivo:!!t.humanoAtivo,atendimento:t.atendimento||'aguardando',consultaPedido:t.consultaPedido||null,modoResposta:t.modoResposta||null};}
async function context(ticket,question){
 let order=null,id=ticket.pedidoId,ask=null;
 const related=['andamento','prazo','cancelamento','reembolso'].includes(basicIntent(question));
 if(id){order=await fbGet('pedidos/'+key(id));if(!order||order.clienteId!==ticket.clienteId)return{pedido:null,pedirPedido:true,erroVinculo:true};}
 else if(related){
  const items=await fbQuery('pedidos','clienteId',ticket.clienteId);
  const own=Object.entries(items||{}).filter(([,p])=>p?.clienteId===ticket.clienteId);
  const reference=String(question).match(/#\s*(\d{1,10})/);
  if(reference){const found=own.find(([,p])=>Number(String(p.numeroPedido||'').replace(/\D/g,''))===Number(reference[1]));if(found)[id,order]=found;else ask='Não localizei esse número entre os seus pedidos. Selecione o pedido correto ao abrir o ticket.';}
  else{const active=own.filter(([,p])=>['executando','pago','enviando','revisao_fornecedor'].includes(p.status));if(active.length===1)[id,order]=active[0];else ask='Selecione o pedido ao abrir um ticket ou informe o número com # para eu consultar sem confundir os seus pedidos.';}
 }
 if(!order)return{pedido:null,pedirPedido:related,mensagemSelecao:ask};
 const p={numero:order.numeroPedido||'Seu pedido',servico:catalog.translate(order.nomeServico||'Serviço').slice(0,250),status:order.status,quantidade:Number(order.quantidade)||null,restam:order.restam??null,enviadoEm:order.enviadoEm||null,cancelamento:order.cancelamento?{estado:order.cancelamento.estado||null,reembolsoEstado:order.cancelamento.reembolsoEstado||null,reembolsoCentavos:order.cancelamento.reembolsoCentavos??null}:null};
 const facts={pedido:p,fornecedorConsultado:false,consultadoEm:Date.now()};
 if(order.orderIdFornecedor){
  try{const live=await statusPedido(order.orderIdFornecedor);if(!live||live.error||live.erro||!providerLabels[live.status])throw Error('unavailable');facts.fornecedorConsultado=true;facts.statusFornecedor=providerLabels[live.status];const remaining=live.remains??live.restam;if(remaining!==null&&remaining!==undefined&&String(remaining).trim()!==''&&Number.isSafeInteger(Number(remaining))&&Number(remaining)>=0&&(p.quantidade===null||Number(remaining)<=p.quantidade))facts.restamFornecedor=Number(remaining);facts.consultadoEm=Date.now();}catch{facts.falhaFornecedor=true;}
 }
 return facts;
}
function response(intent,facts){
 const p=facts.pedido,parts=[];
 let human=['reembolso','pix_manual','recarga','senha','outro'].includes(intent)||!!facts.falhaFornecedor||!!facts.erroVinculo;
 if(p&&['andamento','prazo','cancelamento','reembolso'].includes(intent)){
  parts.push(p.numero+' — '+p.servico+'.');
  parts.push('Situação no painel: '+(labels[p.status]||'em conferência')+'.');
  if(facts.fornecedorConsultado){parts.push('Consultei o fornecedor agora: '+facts.statusFornecedor+'.');if(facts.restamFornecedor!==undefined)parts.push('Quantidade restante informada pelo fornecedor: '+facts.restamFornecedor+(p.quantidade?' de '+p.quantidade:'')+'.');}
  else if(facts.falhaFornecedor)parts.push('Não consegui confirmar o status atual no fornecedor. O estado acima é o registro do painel, não uma confirmação de entrega. Encaminhei para a equipe conferir.');
  else parts.push('Este pedido ainda não tem um envio confirmado ao fornecedor no painel.');
  if(p.enviadoEm&&p.enviadoEm<=Date.now()){const elapsed=Math.floor((Date.now()-p.enviadoEm)/60000);parts.push('Tempo desde o envio: '+(elapsed<60?elapsed+' minuto(s)':Math.floor(elapsed/60)+'h '+elapsed%60+'min')+'.');if(elapsed>1440&&['executando','revisao_fornecedor','enviando'].includes(p.status))human=true;}
  if(p.cancelamento?.reembolsoEstado==='creditado')parts.push('O painel registra R$ '+(Number(p.cancelamento.reembolsoCentavos)/100).toFixed(2).replace('.',',')+' devolvidos ao saldo por esse cancelamento.');
  if(['erro_fornecedor','revisao_fornecedor','estorno_pix_pendente'].includes(p.status))human=true;
 }
 if(facts.pedirPedido&&!p)parts.push(facts.mensagemSelecao||'Não consegui identificar com segurança o seu pedido. Selecione-o no ticket ou informe o número com #.');
 const answers={
  andamento:'O andamento e a quantidade restante são informados pelo fornecedor e podem levar algum tempo para atualizar. Não faça outro pedido para o mesmo link enquanto este estiver ativo.',
  prazo:'Não tenho uma previsão confirmada de conclusão nem acesso ao motivo interno da fila do fornecedor. Os prazos no serviço são estimativas anunciadas. Vou informar somente o que a consulta permite confirmar.',
  cancelamento:'Em Meus pedidos, use Solicitar cancelamento quando o botão estiver disponível. O fornecedor precisa aceitar. A solicitação sozinha não confirma o cancelamento; após a confirmação, o painel confere a devolução da parte não entregue. Eu não envio cancelamentos pelo ticket.',
  reembolso:'Seu pedido de devolução foi encaminhado à equipe para conferir. Eu não altero saldo nem confirmo um estorno bancário pelo ticket. A equipe precisa verificar a situação e os registros de pagamento.',
  pix_manual:'Se você recarregou por PIX manual, envie o comprovante ao responsável pela sua revenda pelo contato exibido em Meu saldo. O saldo só entra após a conferência e aprovação dele. Este ticket não aprova comprovantes nem adiciona saldo. Encaminhei sua dúvida à equipe.',
  recarga:'Em Meu saldo você encontra as opções de recarga. O pagamento e o crédito precisam estar confirmados no painel; não posso considerar uma recarga paga só pelo relato no ticket. Encaminhei para a equipe conferir. Não envie senhas ou chaves de API.',
  senha:'Se você está conectado, entre em Minha conta para consultar seu login e trocar a senha informando a senha atual. Eu não vejo sua senha nem altero credenciais pelo ticket. Se não consegue acessar, a equipe precisa verificar sua identidade.',
  api:'Na aba API você encontra a documentação e a opção de gerar sua chave. Gere ou revogue somente nessa tela e mantenha a chave privada; não cole a chave no ticket. A integração utiliza a URL e o formato mostrados na documentação do painel.',
  como_pedir:'Em Fazer pedido, escolha a rede e o objetivo. Abra um serviço e siga as instruções: elas indicam se o link deve ser do perfil, da publicação ou outro destino. Confira a quantidade, os campos extras e o valor antes de pagar.',
  outro:'Recebi sua pergunta. Não tenho informação suficiente para responder com segurança e encaminhei este ticket para a equipe. Você pode acrescentar detalhes aqui, sem enviar senhas ou chaves de API.'
 };
 parts.push(answers[intent]||answers.outro);
 if(human&&!['outro','reembolso','pix_manual','recarga'].includes(intent))parts.push('Este ticket também foi encaminhado para análise da equipe.');
 return{texto:parts.join('\n\n'),humano:human};
}
async function respond(id){
 key(id);const initial=await fbGet('tickets/'+id);if(!initial||initial.status==='resolvido'||initial.humanoAtivo)return;
 const config=await fbGet('config/suporteIA')||{};if(config.ativo===false)return;
 const token=crypto.randomUUID(),now=Date.now(),revision=Number(initial.revisao||1);
 const claim=await fbTransaction('tickets/'+id,current=>{
  if(!current||current.status==='resolvido'||current.humanoAtivo||Number(current.revisao||1)!==revision||Number(current.revisaoRespondida||0)>=revision||current.automacao?.ate>now)return;
  return{...current,atendimento:'analisando',automacao:{token,ate:now+60000,revisao:revision}};
 });
 if(!claim.committed)return;
 const t=claim.value,last=messages(t).filter(m=>m.autor==='cliente').at(-1),question=last?.texto||t.mensagem;
 let facts,decision,reply;
 try{facts=await context(t,question);decision=await classify(question,facts,config);reply=response(decision.intent,facts);}
 catch{facts={pedido:null,falhaConsulta:true};decision={intent:'outro',modo:'basico',motivo:'falha_consulta'};reply=response('outro',facts);}
 await fbTransaction('tickets/'+id,current=>{
  if(!current||current.status==='resolvido'||current.humanoAtivo||Number(current.revisao||1)!==revision||current.automacao?.token!==token)return;
  const history=messages(current);if(history.length>=80)return;
  const at=Date.now();
  return{...current,resposta:reply.texto,respondidoEm:at,modoResposta:decision.modo,revisaoRespondida:revision,automacao:null,consultaPedido:facts,atendimento:reply.humano?'aguardando_equipe':'aguardando_cliente',humanoAtivo:reply.humano,motivoAutomacao:decision.motivo||null,mensagens:[...history,{autor:'assistente',texto:reply.texto,criadoEm:at,modo:decision.modo,revisao:revision}]};
 });
}
module.exports={respond,context,response,messages,publicTicket};
