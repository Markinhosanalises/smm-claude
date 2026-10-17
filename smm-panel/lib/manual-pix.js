const {fbGet,fbPut,fbQuery,fbTransaction,key}=require('./firebase');
const {fail,text,number}=require('./http');
const {balanceCents}=require('./wallet');
const {digest,rateLimit}=require('./auth');
const {requestKey}=require('./orders');
const money=value=>Math.round(number(value,'Valor',0.01,1000000)*100);
function cleanConfig(value={}){
 const c={ativo:value.ativo===true,tipoChave:value.tipoChave||'aleatoria',chave:value.chave||'',nomeRecebedor:value.nomeRecebedor||'',whatsapp:value.whatsapp||'',instrucoes:value.instrucoes||'',minimo:Number(value.minimo||5)};
 return c;
}
async function settings(owner){return cleanConfig(await fbGet('pix_revendedores/'+key(owner))||{});}
async function ownerOf(customer){
 const owner=customer.revendedorId;
 if(!owner)return null;
 const c=await fbGet('clientes/'+key(owner));
 return c?.role==='revendedor'&&!c.bloqueado?{id:owner,cliente:c}:null;
}
async function enabled(customer){
 const owner=await ownerOf(customer);
 return !!(owner&&(await settings(owner.id)).ativo);
}
function validateConfig(b){
 if(typeof b.ativo!=='boolean')fail('Informe se o PIX manual está ativo');
 if(!b.ativo)return {ativo:false};
 const tipo=text(b.tipoChave,'Tipo da chave',20),value=text(b.chave,'Chave PIX',200);
 const patterns={email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/,telefone:/^\+?[0-9]{10,15}$/,cpf:/^[0-9]{11}$/,cnpj:/^[0-9]{14}$/,aleatoria:/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i};
 if(!patterns[tipo]?.test(value))fail('Confira o formato da chave PIX. CPF/CNPJ sem pontuação; telefone com DDI e DDD.');
 const whatsapp=String(b.whatsapp||'').replace(/\D/g,'');
 if(!/^[0-9]{10,15}$/.test(whatsapp))fail('WhatsApp inválido. Informe DDI, DDD e número.');
 return {ativo:true,tipoChave:tipo,chave:value,nomeRecebedor:text(b.nomeRecebedor,'Nome do recebedor',100),whatsapp,instrucoes:b.instrucoes?text(b.instrucoes,'Instruções',500):'',minimo:money(b.minimo??5)/100};
}
const brief=(id,p)=>({id,referencia:p.referencia,clienteId:p.clienteId,nomeCliente:p.nomeCliente,valor:p.valorCentavos/100,status:p.status,criadoEm:p.criadoEm,decididoEm:p.decididoEm||null,observacao:p.observacao||'',pix:p.pix||null});
async function history(field,id){
 const all=Object.entries(await fbQuery('depositos_manuais',field,id)||{}).filter(([,p])=>p);
 const pending=all.filter(([,p])=>p.status==='pendente');
 const settled=all.filter(([,p])=>p.status!=='pendente').sort((a,b)=>b[1].criadoEm-a[1].criadoEm).slice(0,100);
 return [...pending,...settled].sort((a,b)=>b[1].criadoEm-a[1].criadoEm).map(([id,p])=>brief(id,p));
}
async function customer(req,res,s){
 if(req.method==='GET'){
  const owner=await ownerOf(s.cliente),config=owner?await settings(owner.id):null;
  return res.json({disponivel:!!config?.ativo,configuracao:config?.ativo?config:null,recargas:await history('clienteId',s.clienteId)});
 }
 await rateLimit(req,'manual-pix-request',20,60000);
 const owner=await ownerOf(s.cliente);if(!owner)fail('Revenda indisponível',409);
 const config=await settings(owner.id);if(!config.ativo)fail('PIX manual indisponível',409);
 const cents=money(req.body.valor);if(cents<Math.round(config.minimo*100))fail('Valor mínimo: R$ '+config.minimo.toFixed(2));
 const id='man_'+digest(s.clienteId+':'+owner.id+':'+requestKey(req)),now=Date.now();
 const candidate={clienteId:s.clienteId,nomeCliente:s.cliente.nome,revendedorId:owner.id,valorCentavos:cents,status:'pendente',criadoEm:now,referencia:'PIX-'+id.slice(4,16).toUpperCase(),pix:config};
 const r=await fbTransaction('depositos_manuais/'+id,current=>current||candidate);
 if(r.value.valorCentavos!==cents||r.value.revendedorId!==owner.id||r.value.clienteId!==s.clienteId)fail('Chave já utilizada com outros dados',409);
 return res.json({ok:true,recarga:brief(id,r.value)});
}
async function settle(owner,id,action,observation,candidate){
 key(id);
 let error;const now=Date.now();
 const r=await fbTransaction('',root=>{
  error=null;
  const p=root?.depositos_manuais?.[id]||candidate;
  const merchant=root?.clientes?.[owner];
  const client=p&&root?.clientes?.[p.clienteId];
  if(!p||p.revendedorId!==owner||merchant?.role!=='revendedor'||merchant.bloqueado||!client||client.bloqueado||client.revendedorId!==owner||p.clienteId===owner){error=['Recarga ou cliente não pertence à sua revenda',403];return;}
  if(candidate&&(p.clienteId!==candidate.clienteId||p.valorCentavos!==candidate.valorCentavos||p.fingerprint!==candidate.fingerprint)){error=['Chave já utilizada com outros dados',409];return;}
  const target=action==='aprovar'?'aprovado':'rejeitado';
  if(p.status===target)return root;
  if(p.status!=='pendente'){error=['Esta recarga já foi decidida',409];return;}
  let wallets=root.carteiras||{};
  if(action==='aprovar'){
   const cents=p.valorCentavos;
   if(!Number.isSafeInteger(cents)||cents<1||cents>100000000){error=['Valor inválido',409];return;}
   const source=wallets[owner]||{},destination=wallets[p.clienteId]||{};
   const sourceBalance=balanceCents(source),destinationBalance=balanceCents(destination);
   if(!Number.isSafeInteger(destinationBalance+cents)){error=['Saldo do cliente excede o limite',409];return;}
   if(sourceBalance<cents){error=['Seu saldo pré-pago é insuficiente. Recarregue antes de liberar o saldo do cliente.',409];return;}
   const op='pix_manual_'+id;
   if(source.movimentos?.[op]||destination.movimentos?.[op]){error=['Movimento financeiro inconsistente. Contate o suporte.',409];return;}
   const entry=(centavos,other)=>({centavos,criadoEm:now,tipo:'pix_manual',depositoId:id,contraparte:other});
   wallets={...wallets,[owner]:{...source,saldoCentavos:sourceBalance-cents,saldo:(sourceBalance-cents)/100,movimentos:{...source.movimentos,[op]:entry(-cents,p.clienteId)}},[p.clienteId]:{...destination,saldoCentavos:destinationBalance+cents,saldo:(destinationBalance+cents)/100,ultimoCredito:now,movimentos:{...destination.movimentos,[op]:entry(cents,owner)}}};
  }
  return {...root,carteiras:wallets,depositos_manuais:{...root.depositos_manuais,[id]:{...p,status:target,decididoEm:now,decididoPor:owner,observacao:observation}}};
 });
 if(!r.committed)fail(...(error||['Não foi possível concluir. Tente novamente.',409]));
 return {ok:true,recarga:brief(id,r.value.depositos_manuais[id]),novoSaldo:balanceCents(r.value.carteiras?.[owner])/100};
}
async function reseller(req,res,s){
 if(s.cliente.role!=='revendedor')fail('Acesso negado',403);
 if(req.method==='GET')return res.json({configuracao:await settings(s.clienteId),recargas:await history('revendedorId',s.clienteId)});
 const b=req.body||{};await rateLimit(req,'manual-pix-manage',60,60000);
 if(b.acao==='configurar-pix-manual'){
  const next=validateConfig(b),prior=await settings(s.clienteId);
  await fbPut('pix_revendedores/'+s.clienteId,{...prior,...next,atualizadoEm:Date.now()});
  return res.json({ok:true});
 }
 const observation=b.observacao?text(b.observacao,'Observação',300):'';
 if(b.acao==='rejeitar-pix-manual'){
  if(!observation)fail('Informe o motivo da rejeição');
  return res.json(await settle(s.clienteId,key(b.recargaId),'rejeitar',observation));
 }
 if(!['aprovar-pix-manual','creditar-cliente-manual'].includes(b.acao))fail('Ação inválida');
 if(b.confirmado!==true)fail('Confirme que conferiu o recebimento no seu banco');
 if(b.acao==='aprovar-pix-manual')return res.json(await settle(s.clienteId,key(b.recargaId),'aprovar',observation));
 const customerId=key(b.clienteId),cents=money(b.valor),id='man_'+digest('credit:'+s.clienteId+':'+requestKey(req));
 const target=await fbGet('clientes/'+customerId);
 if(!target||target.revendedorId!==s.clienteId)fail('Cliente não pertence à sua revenda',403);
 const candidate={clienteId:customerId,nomeCliente:target.nome,revendedorId:s.clienteId,valorCentavos:cents,status:'pendente',criadoEm:Date.now(),referencia:'PIX-'+id.slice(4,16).toUpperCase(),origem:'credito_direto',fingerprint:digest(JSON.stringify([customerId,cents,observation]))};
 return res.json(await settle(s.clienteId,id,'aprovar',observation,candidate));
}
module.exports={customer,reseller,enabled,validateConfig};
