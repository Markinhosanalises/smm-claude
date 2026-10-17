const catalog = require('../public/catalog-text');
function normalized(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
const countryGroups = [
 ['Alemanha','germany|german|germans|alemanha|alemao|alemaes'],['Austrália','australia|australian|australians|australianos'],['Bélgica','belgium|belgian|belgians|belgica|belgas'],['China','china|chinese|chineses'],['Coreia','korea|korean|koreans|coreia|coreanos'],['Egito','egypt|egyptian|egyptians|egito|egipcios'],['Espanha','spain|spanish|espanha|espanhois'],['França','france|french|franca|franceses'],['Hong Kong','hong kong|hongkong'],['Indonésia','indonesia|indonesian|indonesians|indonesios'],['Irã','iran|iranian|iranians|persian|persians|ira|iranianos'],['Itália','italy|italian|italians|italia|italianos'],['Japão','japan|japanese|japao|japoneses'],['Nigéria','nigeria|nigerian|nigerians|nigerianos'],['Países Baixos','netherlands|holland|dutch|paises baixos|holanda|holandeses|neerlandeses'],['Paquistão','pakistan|pakistani|pakistanis|paquistao|paquistaneses'],['Reino Unido','united kingdom|great britain|british|britain|england|english|uk|u k|reino unido|inglaterra|britanicos|ingleses'],['Suécia','sweden|swedish|suecia|suecos'],['Suíça','switzerland|swiss|suica|suicos'],['Tailândia','thailand|thai|tailandia|tailandeses'],['Taiwan','taiwan|taiwanese|taiwaneses'],['Canadá','canada|canadian|canadians|canadenses'],['Israel','israel|israeli|israelis|israelenses']
].map(([label,words])=>[label,new RegExp('\\b(?:'+words+')\\b')]);
const african = /\b(?:africa|african|africans|africanos|africanas|nigeria|nigerian|egypt|egyptian|egito|egipcios|kenya|kenyan|quenia|ghana|ghanaian|gana|morocco|moroccan|marrocos|tunisia|tunus ia|tunusia|tunisian|argelia|algeria|algerian|libya|libyan|libia|ethiopia|ethiopian|etiopia|senegal|senegalese|cameroon|cameroonian|camar oes|camaroes|congo|congolese|uganda|ugandan|tanzania|tanzanian|zambia|zambian|zimbabwe|zimbabwean|rwanda|rwandan|angola|angolan|mozambique|mocambique|sudan|sudanese|sudao|somalia|somali|ivory coast|cote d ivoire|costa do marfim|south african)\b/;
function reason(s) {
 if (!s) return '';
 const name=s.nomeOriginal||s.name||s.nomeCustomizado||'', category=s.categoriaOriginal||s.category||'';
 const value=normalized(name+' '+category);
 // Explicit exception: preserve services marketed as Arabic, including mixed origins.
 if (/\b(?:arab|arabs|arabic|arabe|arabes|arabia|arabian)\b/.test(value)) return '';
 const network=catalog.network(category,name);
 if (network==='instagram' && african.test(value)) return 'Instagram: público africano';
 const objective=catalog.objective(category,name,s.tipo||s.type||'Default');
 if (objective!=='Seguidores e inscritos' && !/^Seguidores(?: e inscritos)?$/.test(s.servicoTipo||'')) return '';
 const found=countryGroups.find(([,pattern])=>pattern.test(value));
 return found ? 'Seguidores: '+found[0] : '';
}
function apply(s) { const blocked=reason(s); return blocked ? {...s,ativo:false,bloqueioComercial:blocked} : {...s,bloqueioComercial:null}; }
module.exports={reason,apply,countryGroups};
