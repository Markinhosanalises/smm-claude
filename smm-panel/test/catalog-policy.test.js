const assert=require('node:assert/strict');
module.exports=async()=>{
 const policy=require('../lib/catalog-policy'),catalog=require('../public/catalog-text');
 let count=0;
 for(const [label,regex] of policy.countryGroups){const alias=regex.source.replace(/^.*?\(\?:/,'').split('|')[0];assert(policy.reason({nomeOriginal:'Instagram Followers '+alias,categoriaOriginal:'Instagram Followers'}),label);count++;}
 for(const name of ['Instagram Followers Germany','Instagram Followers Hong-Kong','TikTok Followers United Kingdom','Instagram Followers Países Baixos','Instagram Followers Suíça','Instagram Followers Irã']){assert(policy.reason({nomeOriginal:name}));count++;}
 for(const name of ['Instagram Real Likes Africa','Instagram Comments Nigeria','Instagram Views South Africa','Instagram Likes Egypt']){assert(policy.reason({nomeOriginal:name}));count++;}
 for(const name of ['Instagram Followers Brazil','Instagram Followers Turkey','Instagram Followers Arabic','Instagram Followers Arabic - Iranian','Instagram Likes Arabic','Instagram Followers Ukrainian','TikTok Likes Germany','Youtube Views China','Instagram Likes Canada']){assert.equal(policy.reason({nomeOriginal:name}),'',name);count++;}
 assert.equal(policy.apply({nomeOriginal:'Instagram Followers Germany',ativo:true}).ativo,false);assert.equal(policy.apply({nomeOriginal:'Instagram Followers Arabic',ativo:true}).ativo,true);count++;
 const now=Date.now();assert(catalog.priority({nomeOriginal:'Instagram Real Followers'}).reaisAnunciados);assert(!catalog.priority({nomeOriginal:'Instagram Followers Not Real'}).reaisAnunciados);assert(!catalog.priority({nomeOriginal:'Instagram Fake Real Followers'}).reaisAnunciados);assert(catalog.priority({adicionadoEm:now-1000},now).novo);assert(!catalog.priority({adicionadoEm:now-31*86400000},now).novo);assert(!catalog.priority({adicionadoEm:now+1000},now).novo);assert(!catalog.priority({atualizadoEm:now},now).novo);assert(catalog.priority({categoriaOriginal:'Instagram New Services'}).novidadeAnunciada);count++;
 assert.equal(catalog.priority({nome:'Curtidas reais',reaisAnunciados:false}).reaisAnunciados,false);assert(!/reais/.test(catalog.present({nomeOriginal:'Instagram Likes Bot Quality',nomeCustomizado:'Instagram Real Likes',taxaCusto:1}).nome));count++;
 const items=[{id:'cheap',nomeOriginal:'Instagram Likes',precoPorMil:.01},{id:'real',nomeOriginal:'Instagram Real Likes',precoPorMil:100},{id:'new',nomeOriginal:'Instagram Likes',novo:true},{id:'real-new',nomeOriginal:'Instagram Real Likes',novo:true}];items.sort(catalog.compare);assert.deepEqual(items.map(s=>s.id),['real-new','real','new','cheap']);count++;
 // The order creation path must reject a blocked service before touching the wallet or provider.
 const paths=['../lib/firebase','../lib/auth','../lib/wallet','../lib/orders'];const saved=new Map();for(const p of paths){const id=require.resolve(p);saved.set(id,require.cache[id]);delete require.cache[id];}
 let mutated=false;const fid=require.resolve('../lib/firebase');require.cache[fid]={id:fid,filename:fid,loaded:true,exports:{key:String,fbGet:async path=>path==='catalogo/1'?{nomeOriginal:'Instagram Followers Germany',ativo:true,tipo:'Default',min:10,max:1000}:null,fbTransaction:async()=>{mutated=true;throw Error('unexpected write');}}};
 try{await assert.rejects(require('../lib/orders').create('me',{}, {idFornecedor:1,link:'https://instagram.com/test',quantidade:100},'catalog_policy_test'),e=>e.status===404);assert.equal(mutated,false);count++;}finally{for(const[id,value]of saved){if(value)require.cache[id]=value;else delete require.cache[id];}}
 return count+' catalog policy scenarios passed';
};
if(require.main===module)module.exports().then(console.log).catch(e=>{console.error(e);process.exitCode=1;});
