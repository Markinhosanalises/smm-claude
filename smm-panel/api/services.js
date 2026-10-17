const policy=require('../lib/catalog-policy');
const { fbGet } = require('../lib/firebase');
const { rate } = require('../lib/pricing');
const { session } = require('../lib/auth');
const { endpoint } = require('../lib/http');
const catalog = require('../public/catalog-text');
const forms = require('../public/service-forms');
const networksOrder=['instagram','tiktok','youtube','facebook','twitter','telegram','spotify','whatsapp'];
module.exports=endpoint(async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({erro:'Método não permitido'});
 const customer=(await session(req,'cliente',true))?.cliente||{};
 const [data,config]=await Promise.all([fbGet('catalogo'),fbGet('config')]);
 const active=Object.values(data||{}).filter(s=>s&&s.ativo&&!s.indisponivel&&!policy.reason(s)&&!catalog.technical(s)&&forms.describe(s).supported);
 const query=req.query||{},network=String(query.redeSocial||'').toLowerCase(),objective=String(query.servicoTipo||'').toLowerCase();
 if(!network&&!objective){
  const counts=new Map(),objectives=new Set();
  for(const s of active){const p=catalog.present(s);counts.set(p.redeSocial,(counts.get(p.redeSocial)||0)+1);objectives.add(p.servicoTipo);}
  const redesSociais=[...counts.keys()].sort((a,b)=>{const ia=networksOrder.indexOf(a),ib=networksOrder.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b,'pt-BR');});
  return res.json({redesSociais,tiposServico:[...objectives],redes:redesSociais.map(nome=>({nome,total:counts.get(nome)})),total:active.length});
 }
 const result=[];
 for(const s of active){
  const p=catalog.present(s);
  if(network&&p.redeSocial.toLowerCase()!==network)continue;
  if(objective&&p.servicoTipo.toLowerCase()!==objective)continue;
  const spec=forms.describe(s);
  result.push({...p,id:s.idFornecedor,tipo:s.tipo||'Default',icone:s.icone||'',min:s.min,max:s.max,refill:!!s.refill,cancel:!!s.cancel,dripfeed:!!s.dripfeed,precoPorMil:rate(s,config||{},customer),cobranca:spec.package?'pacote':spec.subscription?'publicacao':'mil'});
 }
 result.sort(catalog.compare);
 return res.json({servicos:result,total:result.length});
});
