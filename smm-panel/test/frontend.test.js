const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const base=path.join(__dirname,'../public');
const wait=()=>new Promise(r=>setTimeout(r,30));
async function page(name,route){
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(base,name),'utf8');const dom=new JSDOM(html,{url:'https://example.com/'+name,runScripts:'outside-only',virtualConsole:console});const w=dom.window,calls=[];
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
