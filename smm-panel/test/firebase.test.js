const test=require('node:test'),assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const dbPath=require.resolve('firebase-admin/database'),actual=require(dbPath);
module.exports=async function checkRootRegistration(){
const app=initializeApp({databaseURL:'https://adapter-test.firebaseio.com'}),sdk=actual.getDatabase(app),calls=[];let detached=0;
const original=require.cache[dbPath].exports;
require.cache[dbPath].exports={getDatabase:()=>({ref:(...args)=>{
const real=sdk.ref(...args);calls.push({args,key:real.key});
return {on:(_event,callback)=>{queueMicrotask(callback);return callback;},off:()=>{detached++;},transaction:async update=>({committed:true,snapshot:{val:()=>update({clientes:{},usuarios:{}})}})};
}})};
try{delete require.cache[require.resolve('../lib/firebase')];const {fbTransaction}=require('../lib/firebase');
const r=await fbTransaction('',root=>({...root,clientes:{demo:{nome:'Teste'}},usuarios:{demo:{whatsapp:'demo'}}}));
assert(r.committed);assert.equal(r.value.clientes.demo.nome,'Teste');assert.equal(r.value.usuarios.demo.whatsapp,'demo');assert.deepEqual(calls[0],{args:[],key:null});
await fbTransaction('rate_limits/test',v=>v);assert.deepEqual(calls[1].args,['rate_limits/test']);assert.equal(detached,2);
}finally{require.cache[dbPath].exports=original;delete require.cache[require.resolve('../lib/firebase')];await deleteApp(app);}
};
if(require.main===module)test('SDK validates atomic registration at root and normal rate-limit paths',module.exports);
