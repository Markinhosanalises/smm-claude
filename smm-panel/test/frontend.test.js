const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const base=path.join(__dirname,'../public');
const wait=()=>new Promise(r=>setTimeout(r,30));
async function page(name,route,query=""){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(base,name),'utf8');const dom=new JSDOM(html,{url:'https://example.com/'+name+(query?'?'+query:''),runScripts:'outside-only',virtualConsole:console});const w=dom.window,calls=[];
 w.Headers=Headers;w.Response=Response;w.fetch=async(input,options={})=>{const u=new URL(String(input));calls.push({url:u,options});const r=await route(u,options);return new Response(JSON.stringify(r?.body??r??{}),{status:r?.status||200,headers:{'Content-Type':'application/json'}});};
 w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;
 for(const file of ['vendor/purify.min.js','safe-html.js','api-client.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   const src=match[1].match(/src="\/([^\"]+)"/);
   if(src){if(!['vendor/purify.min.js','safe-html.js','api-client.js'].includes(src[1]))w.eval(fs.readFileSync(path.join(base,src[1]),'utf8'));}
   else w.eval(match[2]);
 }
 await wait();return{dom,w,calls,errors};
}
const customer={clienteId:'5511999999999',nome:'Maria',usuario:'maria',role:'cliente'};
function common(u){if(u.pathname==='/api/services')return{redesSociais:['instagram'],tiposServico:['Curtidas'],servicos:[]};if(u.pathname==='/api/config')return{whatsappSuporte:'',minRecarga:5};if(u.pathname==='/api/carteira')return{saldo:100,clientes:[]};if(u.pathname==='/api/pedidos')return{pedidos:[]};if(u.pathname==='/api/tickets')return{tickets:[]};return{};}
test('customer login uses sessions; reload cannot trust forged local storage',async()=>{
 let logged=false;const p=await page('app.html',(u,o)=>{if(u.pathname==='/api/auth-cliente'){if(o.method==='POST'){logged=true;return customer;}return logged?customer:{status:401,body:{erro:'Login'}};}return common(u);});
 try{assert.equal(p.w.document.querySelector('#area-logada').classList.contains('hidden'),true);p.w.document.querySelector('#auth-login-id').value='maria';p.w.document.querySelector('#auth-senha').value='password123';p.w.document.querySelector('#btn-login').click();await wait();assert.match(p.w.document.querySelector('#saudacao').textContent,/Maria/);assert(!p.calls.some(c=>c.url.pathname==='/api/revendedor'));assert(!p.calls.some(c=>c.url.searchParams.has('senha')));assert.deepEqual(p.errors,[]);}finally{p.dom.window.close();}
});
test('admin renders hostile tickets as text and uses cookie authentication',async()=>{
 const payload='<img src=x onerror="window.compromised=true"><button class="btn-resolver-ticket" data-id="other">attack</button>';
 const p=await page('admin.html',(u,o)=>{if(u.pathname==='/api/auth-cliente')return{ok:true};if(u.pathname==='/api/tickets')return{tickets:[{id:'ticket1',nome:'Cliente',mensagem:payload,status:'aberto'}]};if(u.pathname==='/api/admin-services')return{servicos:[],pagina:1,totalPaginas:1,redesDisponiveis:[],tiposDisponiveis:[]};return common(u);});
 try{const body=p.w.document.querySelector('#tabela-tickets-body');assert(body.textContent.includes('<img'));assert.equal(body.querySelectorAll('img').length,0);assert.equal(body.querySelectorAll('.btn-resolver-ticket').length,1);assert.equal(p.w.localStorage.getItem('admin_pin'),null);assert(!p.calls.some(c=>c.url.searchParams.has('pin')));assert.equal(p.w.compromised,undefined);assert.deepEqual(p.errors,[]);}finally{p.dom.window.close();}
});
test('sanitizer strips handlers, script URLs and SVG while retaining copy controls',async()=>{
 const p=await page('app.html',(u)=>u.pathname==='/api/auth-cliente'?{status:401,body:{}}:common(u));
 try{const html=p.w.safeHTML('<img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a><svg onload=alert(1)></svg><button data-copy-code data-code="pix">Copiar</button>');const el=p.w.document.createElement('div');el.innerHTML=html;assert(!el.querySelector('[onerror],[onload],svg'));assert.equal(el.querySelector('a').getAttribute('href'),null);assert(el.querySelector('[data-copy-code]'));}finally{p.dom.window.close();}
});
test('API client reuses idempotency after lost response and rotates after success',async()=>{
 let fail=true;const ids=[];const p=await page('app.html',(u)=>u.pathname==='/api/auth-cliente'?{status:401,body:{}}:common(u));
 try{p.w.fetch=()=>{}; // smmFetch retains the original transport; build an isolated client for failure simulation.
 const w=p.w;w.eval(fs.readFileSync(path.join(base,'api-client.js'),'utf8').replace('const nativeFetch = window.fetch.bind(window);',`const nativeFetch = async (u,o) => { window.testIds.push(o.headers.get('Idempotency-Key')); if(window.testFail)throw new Error('lost');return new window.Response('{}',{status:200}); };`));w.testIds=ids;w.testFail=fail;
 const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor:10})};await assert.rejects(w.smmFetch('/api/carteira',options));w.testFail=false;await w.smmFetch('/api/carteira',options);await w.smmFetch('/api/carteira',options);assert.equal(ids[0],ids[1]);assert.notEqual(ids[1],ids[2]);}finally{p.dom.window.close();}
});

test('admin keeps table cells and previews global/custom percentage prices consistently',async()=>{
 let saved;
 const services=[{idFornecedor:139,ativo:true,nomeCustomizado:'Serviço "teste"',categoriaOriginal:'Likes',redeSocial:'instagram',servicoTipo:'Curtidas',taxaCusto:0.7469,lucroPercentual:200},{idFornecedor:187,ativo:true,nomeOriginal:'Likes',taxaCusto:2}];
 const p=await page('admin.html',async(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return{ok:true};
  if(u.pathname==='/api/config'){
   if(o.method==='POST'){saved=JSON.parse(o.body);return{ok:true};}
   await new Promise(r=>setTimeout(r,50));return{lucroPercentualGlobal:50,cotacaoUSDBRL:5.4};
  }
  if(u.pathname==='/api/admin-services')return{servicos:services,pagina:1,totalPaginas:1,porPagina:100,total:2,redesDisponiveis:[],tiposDisponiveis:[]};
  return common(u);
 });
 try{
  await new Promise(r=>setTimeout(r,100));
  const rows=p.w.document.querySelectorAll('#tabela-servicos-body tr');
  assert.equal(rows.length,2);assert.equal(rows[0].cells.length,11);assert.equal(rows[1].cells.length,11);
  assert.equal(rows[0].querySelector('[data-campo="nomeCustomizado"]').value,'Serviço "teste"');
  assert.equal(rows[0].querySelector('.preco-final').textContent,'R$ 12,09978');
  assert.equal(rows[1].querySelector('.preco-final').textContent,'R$ 16,20');
  p.w.document.querySelector('#cfg-lucro').value='0';p.w.document.querySelector('#cfg-salvar').click();await wait();
  assert.equal(saved.lucroPercentualGlobal,'0');
  assert.equal(rows[0].querySelector('.preco-final').textContent,'R$ 12,09978');
  assert.equal(rows[1].querySelector('.preco-final').textContent,'R$ 10,80');
  const margin=rows[0].querySelector('[data-campo="lucroPercentual"]');margin.value='';margin.dispatchEvent(new p.w.Event('input'));
  assert.equal(rows[0].querySelector('.preco-final').textContent,'R$ 4,03326');
  rows[0].querySelector('.btn-salvar-servico').click();await wait();
  const save=p.calls.find(c=>c.url.pathname==='/api/admin-services'&&c.options.method==='POST');
  assert.equal(JSON.parse(save.options.body).lucroPercentual,'');
  assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('table sanitizer preserves cells while removing executable content',async()=>{
 const p=await page('app.html',u=>u.pathname==='/api/auth-cliente'?{status:401,body:{}}:common(u));
 try{const row=p.w.document.createElement('tr');row.innerHTML=p.w.safeRowHTML('<td><img src=x onerror="alert(1)"><svg onload="alert(1)"></svg><a href="javascript:alert(1)">x</a></td><td><input data-campo="lucroPercentual" value="200"></td>');assert.equal(row.cells.length,2);assert(!row.querySelector('[onerror],[onload],svg'));assert.equal(row.querySelector('a').getAttribute('href'),null);assert.equal(row.querySelector('input').value,'200');}finally{p.dom.window.close();}
});

test('beginner purchase flow explains steps, quantities and total before payment',async()=>{
 const service={id:'cheap',nome:'Instagram Likes [No Refill]',servicoTipo:'Curtidas',tipo:'Default',precoPorMil:0.4,min:10,max:1000};
 const p=await page('app.html',u=>{
  if(u.pathname==='/api/auth-cliente')return customer;
  if(u.pathname==='/api/services')return u.searchParams.has('redeSocial')?{servicos:[service]}:{redesSociais:['instagram']};
  return common(u);
 });
 try{
  const d=p.w.document;p.w.HTMLElement.prototype.scrollIntoView=()=>{};
  d.querySelector('.rede-tab').click();await wait();assert.equal(d.querySelector('#passo-tipo').getAttribute('aria-current'),'step');
  d.querySelector('.tipo-chip').click();const card=d.querySelector('.servico-card');assert.equal(card.tagName,'BUTTON');assert.match(card.textContent,/sem reposição/i);assert(!card.textContent.includes('/un'));
  card.click();assert.equal(d.querySelector('#passo-pagar').getAttribute('aria-current'),'step');assert.equal(d.querySelector('#eng-qtd').value,'13');
  const link=d.querySelector('#eng-link'),qty=d.querySelector('#eng-qtd');link.value='invalido';link.dispatchEvent(new p.w.Event('input'));assert.match(d.querySelector('#eng-validacao').textContent,/https/);
  link.value='https://instagram.com/p/post';link.dispatchEvent(new p.w.Event('input'));assert.equal(d.querySelector('#eng-resultado').classList.contains('hidden'),false);assert.match(d.querySelector('#eng-preco').textContent,/0,01/);
  qty.value='2.5';qty.dispatchEvent(new p.w.Event('input'));assert.equal(d.querySelector('#eng-resultado').classList.contains('hidden'),true);assert.match(d.querySelector('#eng-validacao').textContent,/inteir/);
  qty.value='1000';qty.dispatchEvent(new p.w.Event('input'));assert.match(d.querySelector('#eng-preco').textContent,/0,40/);assert.match(d.querySelector('#eng-resumo').textContent,/Instagram/);
  assert(!p.calls.some(c=>c.url.pathname==='/api/order'));assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('custom comments and bounded subscriptions show correct fields and checkout payload',async()=>{
 const entries=[
 {id:'comments',nome:'Instagram Custom Comments',redeSocial:'instagram',servicoTipo:'Comentários',tipo:'Custom Comments',precoPorMil:10,min:2,max:100},
 {id:'subscription',nome:'Instagram Auto Likes',redeSocial:'instagram',servicoTipo:'Acompanhamento automático',tipo:'Subscriptions',precoPorMil:10,min:10,max:1000}
 ];
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return customer;
  if(u.pathname==='/api/services')return u.searchParams.has('redeSocial')?{servicos:entries}:{redesSociais:['instagram']};
  if(u.pathname==='/api/order')return{status:'executando',novoSaldo:100,pedidoId:'fake'};
  return common(u);
 });
 try{
 const d=p.w.document;p.w.HTMLElement.prototype.scrollIntoView=()=>{};
 d.querySelector('.rede-tab').click();await wait();
 [...d.querySelectorAll('.tipo-chip')].find(b=>b.textContent==='Comentários').click();d.querySelector('.servico-card').click();
 assert(d.querySelector('#eng-qtd-wrap').classList.contains('hidden'));assert(!d.querySelector('#eng-comments-wrap').classList.contains('hidden'));
 d.querySelector('#eng-link').value='https://instagram.com/p/post';d.querySelector('#eng-comments').value='Primeiro\nSegundo\nTerceiro';d.querySelector('#eng-comments').dispatchEvent(new p.w.Event('input'));
 assert(!d.querySelector('#eng-resultado').classList.contains('hidden'));assert.match(d.querySelector('#eng-preco').textContent,/0,03/);
 d.querySelector('#eng-pagar-saldo').click();await wait();const first=p.calls.find(c=>c.url.pathname==='/api/order');assert.equal(JSON.parse(first.options.body).quantidade,3);
 [...d.querySelectorAll('.tipo-chip')].find(b=>b.textContent==='Acompanhamento automático').click();d.querySelector('.servico-card').click();
 assert(d.querySelector('#eng-link-wrap').classList.contains('hidden'));assert(d.querySelector('#pedido-username'));assert(d.querySelector('#pedido-posts'));assert(d.querySelector('#pedido-expiry'));
 d.querySelector('#pedido-username').value='meuperfil';d.querySelector('#eng-qtd').value='100';d.querySelector('#pedido-posts').value='2';d.querySelector('#pedido-posts').dispatchEvent(new p.w.Event('input'));
 assert.match(d.querySelector('#eng-preco').textContent,/2,00/);assert.match(d.querySelector('#eng-resumo').textContent,/sem renovação/);
 d.querySelector('#eng-pagar-saldo').click();await wait();const calls=p.calls.filter(c=>c.url.pathname==='/api/order');assert.equal(calls.length,2);const body=JSON.parse(calls[1].options.body);assert.equal(Number(body.posts),2);assert.equal(body.username,'meuperfil');assert(body.expiry);
 assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('linked customer requests manual PIX, sees seller instructions and cannot approve',async()=>{
 const recarga={id:'man_demo',referencia:'PIX-DEMO123',valor:25,status:'pendente',criadoEm:Date.now(),pix:{chave:'vendedor@example.invalid',nomeRecebedor:'Vendedor <img src=x onerror=alert(1)>',whatsapp:'5511999999999',instrucoes:'Envie o comprovante.'}};
 let requested=false,depositApproved=false;
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return customer;
  if(u.pathname==='/api/carteira'&&u.searchParams.get('action')==='pix-manual')return{disponivel:true,configuracao:{minimo:5},recargas:requested?[{...recarga,status:depositApproved?'aprovado':'pendente'}]:[]};
  if(u.pathname==='/api/carteira'&&o.method==='POST'){assert.equal(JSON.parse(o.body).action,'solicitar-pix-manual');requested=true;return{ok:true,recarga};}
  return common(u);
 });
 try{
  p.w.document.querySelector('#tab-carteira').click();await wait();
  assert(p.w.document.querySelector('#recarga-automatica').classList.contains('hidden'));
  p.w.document.querySelector('#manual-valor').value='25';p.w.document.querySelector('#manual-solicitar').click();await wait();await wait();
  assert.match(p.w.document.querySelector('#manual-dados').textContent,/PIX-DEMO123/);
  assert.equal(p.w.document.querySelector('#manual-dados img'),null);
  const link=p.w.document.querySelector('#manual-dados a');assert.match(link.href,/^https:\/\/wa.me\/5511999999999\?text=/);
  assert.match(decodeURIComponent(link.href),/PIX-DEMO123/);
  assert.equal(p.w.document.querySelector('#manual-chave-copia').value,'vendedor@example.invalid');
  const request=p.calls.find(c=>c.options.method==='POST'&&c.url.pathname==='/api/carteira');assert(request);assert(request.options.headers.get('Idempotency-Key'));
  assert(!('revendedorId'in JSON.parse(request.options.body)));
  assert(!p.calls.some(c=>c.url.pathname==='/api/pagamento'));depositApproved=true;p.w.document.querySelector('#manual-atualizar').click();await wait();await wait();assert.match(p.w.document.querySelector('#manual-dados').textContent,/Saldo liberado/);assert.equal(p.w.document.querySelector('#manual-dados a'),null);assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});
test('reseller verifies receipt before approving and client names remain text',async()=>{
 const merchant={...customer,role:'revendedor'},deposit={id:'man_demo',referencia:'PIX-DEMO123',clienteId:'child',nomeCliente:'<img src=x onerror=alert(1)>',valor:25,status:'pendente',criadoEm:Date.now()};
 let approved=false;
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return merchant;
  if(u.pathname==='/api/revendedor'){
   if(o.method==='POST'){const b=JSON.parse(o.body);assert.equal(b.acao,'aprovar-pix-manual');assert.equal(b.confirmado,true);approved=true;return{ok:true,novoSaldo:75};}
   if(u.searchParams.get('action')==='clientes')return{clientes:[{clienteId:'child',nome:'Cliente',whatsapp:'5511888888888'}]};
   if(u.searchParams.get('action')==='pix-manual')return{configuracao:{ativo:true,tipoChave:'email',chave:'vendedor@example.invalid',nomeRecebedor:'Vendedor',whatsapp:'5511999999999',minimo:5},recargas:[{...deposit,status:approved?'aprovado':'pendente'}]};
   return{nome:'Vendedor',saldo:100,desconto:10};
  }return common(u);
 });
 try{
  p.w.document.querySelector('#tab-revendedor').click();await wait();p.w.document.querySelector('#tab-rev-pix').click();await wait();await wait();
  const list=p.w.document.querySelector('#rev-pix-recargas');assert.equal(list.querySelector('img'),null);assert(list.textContent.includes('<img'));
  const approve=list.querySelector('.btn');assert.equal(approve.disabled,true);approve.click();await wait();assert.equal(approved,false);
  const check=list.querySelector('input[type=checkbox]');check.checked=true;check.dispatchEvent(new p.w.Event('change'));assert.equal(approve.disabled,false);approve.click();await wait();await wait();
  assert.equal(approved,true);assert.match(p.w.document.querySelector('#rev-pix-msg').textContent,/uma vez/);assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('invited sub-reseller chooses credentials and enters own reseller area',async()=>{
 const token='a'.repeat(64);
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente'){
   if(u.searchParams.get('acao')==='convite-subrevenda')return{valido:true,nomeRevenda:'Loja principal',expiraEm:Date.now()+86400000};
   if(o.method==='POST')return{clienteId:'child',nome:'Minha sub-revenda',usuario:'minhaloja',role:'revendedor'};
   return{status:401,body:{erro:'Login'}};
  }
  if(u.pathname==='/api/revendedor')return{clientes:[],subrevendedores:[],convites:[]};
  return common(u);
 },'convite='+token);
 try{
  assert.match(p.w.document.querySelector('#sub-convite-msg').textContent,/Loja principal/);
  assert.equal(p.w.document.querySelector('#bloco-cadastro').classList.contains('hidden'),false);
  for(const[id,value]of [['auth-nome','Minha sub-revenda'],['auth-usuario','minhaloja'],['auth-whats','5511999999999'],['auth-senha-cad','StrongPassword123']])p.w.document.getElementById(id).value=value;
  p.w.document.querySelector('#btn-cadastrar').click();await wait();await wait();
  const signup=p.calls.find(c=>c.url.pathname==='/api/auth-cliente'&&c.options.method==='POST'),body=JSON.parse(signup.options.body);
  assert.equal(body.acao,'cadastro-subrevendedor');assert.equal(body.convite,token);assert(!('role'in body));assert.equal(p.w.document.querySelector('#tab-revendedor').classList.contains('hidden'),false);
  assert.equal(p.w.location.search,'');assert.equal(p.w.document.querySelector('#auth-senha-cad').value,'');assert(!JSON.stringify(p.w.localStorage).includes(token));assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});
test('reseller generates a shareable one-use invitation from own panel',async()=>{
 const url='https://example.com/app.html?convite='+'a'.repeat(64);
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return{...customer,role:'revendedor'};
  if(u.pathname==='/api/revendedor'){
   if(o.method==='POST')return{ok:true,url,expiraEm:Date.now()+7*86400000};
   if(u.searchParams.get('action')==='subrevendas')return{subrevendedores:[{clienteId:'child',nome:'<img src=x onerror=alert(1)>',usuario:'subloja',saldo:10}],convites:[]};
   if(u.searchParams.get('action')==='clientes')return{clientes:[]};
   return{nome:'Revenda',saldo:100};
  }return common(u);
 });
 try{
  p.w.document.querySelector('#tab-revendedor').click();await wait();p.w.document.querySelector('#tab-rev-subrevendas').click();await wait();
  assert.equal(p.w.document.querySelector('#rev-sub-lista img'),null);assert(p.w.document.querySelector('#rev-sub-lista').textContent.includes('<img'));
  p.w.document.querySelector('#rev-sub-convite').click();await wait();await wait();
  assert.equal(p.w.document.querySelector('#rev-sub-link').value,url);
  const call=p.calls.find(c=>c.url.pathname==='/api/revendedor'&&c.options.method==='POST');assert.deepEqual(JSON.parse(call.options.body),{acao:'criar-convite-subrevenda'});assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('my account shows own login, edits name and treats profile text safely',async()=>{
 const profile={nome:'Maria',usuario:'maria',whatsapp:'5511999999999',role:'cliente',desconto:20,criadoEm:1,apiAtiva:true};
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente'){
   if(o.method==='POST'){const b=JSON.parse(o.body);assert.equal(b.acao,'atualizar-perfil');assert.deepEqual(Object.keys(b).sort(),['acao','nome']);return{ok:true,conta:{...profile,nome:b.nome}};}
   if(u.searchParams.get('acao')==='minha-conta')return profile;
   return customer;
  }return common(u);
 });
 try{
  p.w.document.querySelector('#tab-conta').click();await wait();
  assert.equal(p.w.document.querySelector('#conta-usuario').value,'maria');assert.equal(p.w.document.querySelector('#conta-usuario').readOnly,true);
  assert.equal(p.w.document.querySelector('#conta-whatsapp').readOnly,true);assert.equal(p.w.document.querySelector('#conta-desconto').textContent,'20%');
  const name='<img src=x onerror=alert(1)>';p.w.document.querySelector('#conta-nome').value=name;p.w.document.querySelector('#conta-perfil-form').dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await wait();
  assert.equal(p.w.document.querySelector('#saudacao').textContent,'Olá, '+name);assert.equal(p.w.document.querySelector('#saudacao img'),null);assert.match(p.w.document.querySelector('#conta-msg').textContent,/atualizado/);assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});
test('password form validates confirmation, toggles visibility and clears secrets on success',async()=>{
 let logged=true;
 const profile={nome:'Maria',usuario:'maria',whatsapp:'5511999999999',role:'cliente'};
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente'){
   if(o.method==='POST'){const b=JSON.parse(o.body);assert.equal(b.acao,'alterar-senha');logged=false;return{ok:true,novoLoginNecessario:true};}
   if(u.searchParams.get('acao')==='minha-conta')return profile;
   return logged?customer:{status:401,body:{erro:'Login'}};
  }return common(u);
 });
 try{
  p.w.document.querySelector('#tab-conta').click();await wait();
  const current=p.w.document.querySelector('#conta-senha-atual'),next=p.w.document.querySelector('#conta-nova-senha'),confirmation=p.w.document.querySelector('#conta-confirmacao'),form=p.w.document.querySelector('#conta-senha-form');
  current.value='OldStrongPassword123';next.value='NewStrongPassword456';confirmation.value='MismatchPassword';
  form.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await wait();
  assert.match(p.w.document.querySelector('#conta-senha-msg').textContent,/confirmação/);assert(!p.calls.some(c=>c.options.method==='POST'));
  const toggle=p.w.document.querySelector('[data-conta-password="conta-nova-senha"]');toggle.click();assert.equal(next.type,'text');assert.equal(toggle.getAttribute('aria-pressed'),'true');toggle.click();assert.equal(next.type,'password');
  confirmation.value=next.value;form.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await wait();await wait();
  assert.equal(p.w.document.querySelector('#area-logada').classList.contains('hidden'),true);assert.match(p.w.document.querySelector('#auth-msg').textContent,/Senha alterada com sucesso/);assert.equal(p.w.document.querySelector('#auth-login-id').value,'maria');
  for(const input of [current,next,confirmation])assert.equal(input.value,'');assert.equal(p.w.document.querySelector('#conta-usuario').value,'');
  assert(!JSON.stringify(p.w.localStorage).includes('StrongPassword'));assert(!JSON.stringify(p.w.sessionStorage).includes('StrongPassword'));assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});

test('customer requests cancellation only after confirmation and sees pending state without fake progress',async()=>{
 let requested=false,posts=0;
 const order={id:'order-demo',numeroPedido:'#00123',nomeServico:'Instagram Curtidas',status:'executando',quantidade:100,restam:'100',startCount:0,valorTotal:10,criadoEm:Date.now(),orderIdFornecedor:55,podeSolicitarCancelamento:true,pagamento:'saldo'};
 const p=await page('app.html',(u,o)=>{
  if(u.pathname==='/api/auth-cliente')return customer;
  if(u.pathname==='/api/pedidos'){
   if(o.method==='POST'){posts++;assert.deepEqual(JSON.parse(o.body),{action:'solicitar-cancelamento',pedidoId:'order-demo'});requested=true;return{ok:true};}
   return{pedidos:[{...order,...(requested?{podeSolicitarCancelamento:false,cancelamento:{estado:'solicitado'}}:{})}]};
  }
  return common(u);
 });
 try{
  p.w.document.querySelector('#tab-pedidos').click();await wait();await wait();
  assert.match(p.w.document.querySelector('#lista-pedidos').textContent,/0% concluído/);
  const button=p.w.document.querySelector('.btn-cancelar-pedido');assert(button);
  p.w.confirm=()=>false;button.click();await wait();assert.equal(posts,0);
  p.w.confirm=()=>true;button.click();await wait();await wait();
  assert.equal(posts,1);assert.equal(p.w.document.querySelector('.btn-cancelar-pedido'),null);
  assert.match(p.w.document.querySelector('#lista-pedidos').textContent,/Aguardando confirmação do fornecedor/);
  assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close();}
});
test('non-cancellable services show explanation without a cancellation button',async()=>{
 const p=await page('app.html',(u)=>{if(u.pathname==='/api/auth-cliente')return customer;if(u.pathname==='/api/pedidos')return{pedidos:[{id:'one',status:'executando',quantidade:100,restam:0,startCount:0,valorTotal:1,criadoEm:1,podeSolicitarCancelamento:false}]};return common(u);});
 try{p.w.document.querySelector('#tab-pedidos').click();await wait();await wait();assert.equal(p.w.document.querySelector('.btn-cancelar-pedido'),null);assert.match(p.w.document.querySelector('#lista-pedidos').textContent,/não oferece cancelamento/);assert.match(p.w.document.querySelector('#lista-pedidos').textContent,/100% concluído/);}finally{p.dom.window.close();}
});
