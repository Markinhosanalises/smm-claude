// Run during maintenance with server credentials. Default is read-only.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { fbGet, fbTransaction, key } = require('../lib/firebase');
const { getApps, deleteApp } = require('firebase-admin/app');
async function main() {
  const apply = process.argv.includes('--apply');
  const customers = await fbGet('clientes') || {};
  const wallets = await fbGet('carteiras') || {};
  let passwords = 0, keys = 0, balances = 0;
  for (const [id,c] of Object.entries(customers)) {
    if (!c) continue;
    key(id);
    if (c.senha) {
      passwords++;
      if (apply) {
        const salt=crypto.randomBytes(16).toString('hex');
        const hash='scrypt$'+salt+'$'+(await scrypt(String(c.senha),salt,64)).toString('hex');
        await fbTransaction('clientes/'+id,current=>{
          if (!current || current.senha!==c.senha) return;
          const {senha, ...rest}=current;
          return {...rest,passwordHash:current.passwordHash||hash};
        });
      }
    }
    if(c.apiKey){keys++;if(apply)await fbTransaction('clientes/'+id,current=>{if(!current)return;const {apiKey,...rest}=current;return rest;});}
  }
  // Purge plain legacy index entries; hashed (64 hex) entries remain intact.
  const index=await fbGet('api_keys')||{};
  if(apply)for(const id of Object.keys(index))if(id.startsWith('fsx_'))await fbTransaction('api_keys/'+key(id),()=>null);
  for(const [id,w] of Object.entries(wallets)){
    if(!w||w.saldoCentavos!==undefined)continue;
    const cents=Math.round(Number(w.saldo||0)*100);
    if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Há saldo inválido; revise manualmente antes de migrar.');
    balances++;
    if(apply)await fbTransaction('carteiras/'+key(id),current=>current&&current.saldoCentavos===undefined?{...current,saldoCentavos:Math.round(Number(current.saldo||0)*100)}:undefined);
  }
  console.log(JSON.stringify({mode:apply?'aplicado':'prévia',senhas:passwords,chavesAntigas:keys,carteiras:balances}));
}
main().catch(e=>{console.error('Migração falhou:',e.message);process.exitCode=1;}).finally(async()=>{await Promise.all(getApps().map(deleteApp));});
