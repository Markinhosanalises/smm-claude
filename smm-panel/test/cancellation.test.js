const assert=require('node:assert/strict');
module.exports=async()=>{
 const paths=['../lib/firebase','../lib/fornecedor','../lib/wallet','../lib/order-status','../lib/order-cancellation','../lib/auth','../api/pedidos'];
 const saved=new Map();for(const p of paths){const id=require.resolve(p);saved.set(id,require.cache[id]);delete require.cache[id];}
 let root,queue=Promise.resolve(),calls,mode,providerStatus,providerRemains,cancellable;
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const get=p=>p?p.split('/').reduce((v,k)=>v?.[k],root)??null:root;
 const set=(p,v)=>{if(!p){root=clone(v);return;}const keys=p.split('/'),last=keys.pop();let at=root;for(const k of keys)at=at[k]||(at[k]={});at[last]=clone(v);};
 const fake={key:v=>{if(!v)throw new Error('bad key');return String(v);},fbGet:async p=>clone(get(p)),fbQuery:async(p,f,v)=>Object.fromEntries(Object.entries(get(p)||{}).filter(([,r])=>r[f]===v)),fbTransaction:(p,fn)=>{const task=queue.then(()=>{const next=fn(clone(get(p)));if(next===undefined)return{committed:false,value:clone(get(p))};set(p,next);return{committed:true,value:clone(next)};});queue=task.catch(()=>{});return task;}};
 function stub(p,exports){const id=require.resolve(p);require.cache[id]={id,filename:id,loaded:true,exports};}
 stub('../lib/firebase',fake);
 stub('../lib/fornecedor',{listarServicos:async()=>[{service:1,cancel:cancellable}],statusPedido:async()=>({status:providerStatus,remains:providerRemains,start_count:0}),cancelarPedido:async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(mode==='timeout')throw new Error('timeout');if(mode==='reject')return[{order:55,cancel:{error:'not allowed'}}];if(mode==='unknown')return[{order:999,cancel:1}];return[{order:55,cancel:1}];}});
 stub('../lib/auth',{session:async(req,role,optional)=>{if(role==='admin'&&optional)return null;if(!req.user){const e=new Error('Login');e.status=401;throw e;}return{clienteId:req.user,cliente:{role:'cliente'}};},rateLimit:async()=>{},requireAdmin:async()=>{const e=new Error('Admin');e.status=403;throw e;}});
 const cancellation=require('../lib/order-cancellation'),refresh=require('../lib/order-status').refresh,handler=require('../api/pedidos');
 const oldUrl=process.env.APP_URL;process.env.APP_URL='https://example.com';
 function reset(){root={pedidos:{one:{clienteId:'alice',idFornecedor:1,orderIdFornecedor:55,status:'executando',quantidade:100,valorCentavos:1000,valorTotal:10,workflowVersion:2,pagamento:'saldo'}},carteiras:{alice:{saldoCentavos:2000,saldo:20,movimentos:{order_one:{centavos:-1000}}}},catalogo:{1:{cancel:true}}};queue=Promise.resolve();calls=0;mode='ok';providerStatus='In progress';providerRemains=100;cancellable=true;}
 async function call(user,method='POST',query={},headers={}){const req={user,method,query,headers:{origin:'https://example.com','content-type':'application/json',...headers},body:{action:'solicitar-cancelamento',pedidoId:'one'}};const out={status:200};const res={setHeader(){},status(n){out.status=n;return res;},json(body){out.body=body;return res;}};await handler(req,res);return out;}
 let n=0;
 try{
  reset();assert.equal((await call(null)).status,401);assert.equal((await call('bob')).status,404);assert.equal((await call('alice','POST',{}, {origin:'https://evil.test'})).status,403);assert.equal(calls,0);n++;
  reset();cancellable=false;assert.equal((await call('alice')).status,409);assert.equal(calls,0);assert(!get('pedidos/one/cancelamento'));n++;
  reset();const result=await Promise.all([call('alice'),call('alice')]);assert(result.every(r=>r.status===200));assert.equal(calls,1);assert.equal(get('pedidos/one/cancelamento/estado'),'solicitado');assert.equal(get('carteiras/alice/saldo'),20);await call('alice');assert.equal(calls,1);n++;
  reset();mode='reject';await call('alice');assert.equal(get('pedidos/one/cancelamento/estado'),'recusado');assert.equal(get('carteiras/alice/saldo'),20);n++;
  for(const m of ['timeout','unknown']){reset();mode=m;await call('alice');await call('alice');assert.equal(calls,1);assert.equal(get('pedidos/one/cancelamento/estado'),'incerto');assert.equal(get('carteiras/alice/saldo'),20);n++;}
  reset();await call('alice');providerStatus='Canceled';await Promise.all([refresh('one'),refresh('one'),refresh('one')]);assert.equal(get('pedidos/one/status'),'cancelado');assert.equal(get('pedidos/one/cancelamento/reembolsoEstado'),'creditado');assert.equal(get('carteiras/alice/saldo'),30);assert.equal(get('carteiras/alice/movimentos/cancel_refund_one/centavos'),1000);await refresh('one');assert.equal(get('carteiras/alice/saldo'),30);n++;
  reset();await call('alice');providerStatus='Partial';providerRemains=25;await refresh('one');assert.equal(get('carteiras/alice/saldo'),22.5);assert.equal(get('pedidos/one/cancelamento/reembolsoCentavos'),250);n++;
  reset();await call('alice');providerStatus='Completed';providerRemains=0;await refresh('one');assert.equal(get('carteiras/alice/saldo'),20);assert.equal(get('pedidos/one/status'),'concluido');n++;
  for(const invalid of [null,'',-1,101,'oops']){reset();await call('alice');providerStatus='Canceled';providerRemains=invalid;await refresh('one');assert.equal(get('carteiras/alice/saldo'),20);assert.equal(get('pedidos/one/cancelamento/reembolsoEstado'),'revisao');n++;}
  reset();root.pedidos.one.workflowVersion=1;await call('alice');providerStatus='Canceled';await refresh('one');assert.equal(get('carteiras/alice/saldo'),20);assert.equal(get('pedidos/one/cancelamento/reembolsoEstado'),'revisao');n++;
  reset();root.pedidos.one.assinatura=true;await call('alice');providerStatus='Canceled';await refresh('one');assert.equal(get('carteiras/alice/saldo'),20);n++;
  reset();root.pedidos.one.pagamento='pix';root.pedidos.one.paymentId=123;root.pedidos.one.pagoEm=1;delete root.carteiras.alice.movimentos.order_one;await call('alice');providerStatus='Canceled';await refresh('one');assert.equal(get('carteiras/alice/saldo'),30);n++;
  reset();providerStatus='Completed';assert.equal((await call('alice')).status,409);assert.equal(calls,0);n++;
  reset();const pending=await call('alice','GET',{clienteId:'alice'});assert.equal(pending.body.pedidos[0].podeSolicitarCancelamento,true);assert.equal(cancellation.eligible(root.pedidos.one,{cancel:'false'}),false);n++;
  return n+' cancellation scenarios passed';
 }finally{if(oldUrl===undefined)delete process.env.APP_URL;else process.env.APP_URL=oldUrl;for(const[id,value]of saved){if(value)require.cache[id]=value;else delete require.cache[id];}}
};
if(require.main===module)module.exports().then(console.log).catch(e=>{console.error(e);process.exitCode=1;});
