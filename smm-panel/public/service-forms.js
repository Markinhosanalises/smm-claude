(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OrderForms=api;})(typeof window!=='undefined'?window:this,function(){
'use strict';
var delays=[0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600];
var types=['Default','Package','SEO','Custom Comments','Mentions Custom List','Mentions Hashtag','Mentions User Followers','Custom Comments Package','Comment Likes','Poll','Comment Replies','Invites from Groups','Subscriptions'];
function fail(message){var e=new Error(message);e.status=400;throw e;}
function integer(v,label,min,max){var n=Number(v);if(String(v==null?'':v).trim()===''||!Number.isSafeInteger(n)||n<min||n>max)fail(label+': informe um número inteiro entre '+min+' e '+max+'.');return n;}
function text(v,label,max){if(typeof v!=='string'||!v.trim()||v.length>(max||10000))fail('Preencha '+label.toLowerCase()+'.');return v.trim();}
function lines(v,label){var list=text(v,label,50000).split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);if(list.length>10000)fail(label+': limite de 10.000 linhas.');return list;}
function link(v,label){var value=text(v,label,2048),u;try{u=new URL(value);}catch(e){fail(label+': cole o endereço completo, começando com https://');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)fail('Link inválido. Use o endereço público, sem senha.');return u.href;}
function type(s){return s.tipo||s.type||'Default';}
function packageType(s){return type(s)==='Package'||type(s)==='Custom Comments Package';}
function target(s){
 var value=String((s.servicoTipo||'')+' '+(s.nome||s.nomeCustomizado||s.nomeOriginal||'')+' '+(s.categoria||s.categoriaOriginal||'')+' '+(s.descricao||'')).toLowerCase();
 var network=String(s.redeSocial||'').toLowerCase();
 if(type(s)==='Subscriptions')return {label:'Usuário do perfil',kind:'profile',example:'seuusuario',instruction:'Informe o usuário público que receberá o acompanhamento. Não informe a senha. Escolha um limite de publicações e a data final; não há renovação automática.'};
 if(/poll|enquete|votes|votos/.test(value))return {label:'Link da enquete',kind:'poll',example:network==='telegram'?'https://t.me/canal/123':'https://www.facebook.com/…',instruction:'Abra a publicação da enquete e copie seu link público. Informe também o número da alternativa que deve receber os votos.'};
 if(/story|stories|storie/.test(value))return {label:'Link do story',kind:'story',example:'https://www.instagram.com/stories/seuusuario/…',instruction:'Cole o link do story público. Ele precisa continuar disponível durante o processamento.'};
 if(/page likes|profile likes|curtidas.*página|página.*curtidas|visitas ao perfil|profile visits|artist followers/.test(value))return {label:'Link do perfil ou página',kind:'profile',example:network==='facebook'?'https://www.facebook.com/suapagina':network==='spotify'?'https://open.spotify.com/artist/…':'https://…',instruction:'Cole o link público do perfil, página ou artista indicado no serviço. Não use o link de uma publicação e não informe sua senha.'};
 if(/follow|seguidor|subscriber|inscrit|member|membro|channel|canal/.test(value)&&!/comment|comentar|curtida|like|view|visualiza|play|reprodu/.test(value))return {label:/member|membro|channel|canal/.test(value)?'Link do canal ou grupo':'Link do perfil',kind:'profile',example:network==='telegram'?'https://t.me/seucanal':network==='tiktok'?'https://www.tiktok.com/@seuusuario':network==='youtube'?'https://www.youtube.com/@seucanal':network==='facebook'?'https://www.facebook.com/suapagina':network==='instagram'?'https://www.instagram.com/seuusuario/':'https://…',instruction:'Abra o perfil, canal ou grupo que vai receber o serviço e copie o link. Mantenha o destino acessível durante a entrega. Não envie sua senha.'};
 if(network==='spotify'||network==='soundcloud'||network==='apple music')return {label:'Link da música, álbum ou playlist',kind:'media',example:network==='spotify'?'https://open.spotify.com/track/…':'https://…',instruction:'Cole o link da música, álbum ou playlist indicado no nome do serviço. Confira se escolheu a modalidade correta antes de pagar.'};
 if(/website|traffic|site|tráfego/.test(value)&&network!=='youtube')return {label:'Link da página do site',kind:'website',example:'https://seusite.com/pagina',instruction:'Cole o endereço completo da página pública que deve receber as visitas.'};
 if(/view|visualiza|video|vídeo|reel|watch|assist/.test(value))return {label:'Link do vídeo ou reel',kind:'post',example:network==='youtube'?'https://www.youtube.com/watch?v=…':network==='tiktok'?'https://www.tiktok.com/@seuusuario/video/…':'https://www.instagram.com/reel/…/',instruction:'Abra o vídeo ou reel, toque em Compartilhar e copie o link da publicação. Não use apenas o endereço do perfil.'};
 return {label:'Link da publicação',kind:'post',example:network==='telegram'?'https://t.me/seucanal/123':network==='youtube'?'https://www.youtube.com/watch?v=…':'https://www.instagram.com/p/…/',instruction:'Cole o link público da publicação que vai receber o serviço. Para curtidas, comentários, compartilhamentos e salvamentos, use a publicação, e não apenas o perfil.'};
}
function field(key,label,input,help,placeholder,extra){return Object.assign({key:key,label:label,input:input||'text',help:help||'',placeholder:placeholder||'',required:true},extra||{});}
function describe(s){
 var t=type(s),dest=target(s),fields=[];
 if(types.indexOf(t)<0) return {supported:false,type:t,fields:[],instruction:'Modalidade ainda não identificada.'};
 var quantity=true,derived=null;
 if(t==='Package'||t==='Custom Comments Package'){quantity=false;derived='package';}
 if(['Custom Comments','Comment Replies','Mentions Custom List'].includes(t)){quantity=false;derived=t==='Mentions Custom List'?'usernames':'comments';}
 if(t==='Default'&&s.dripfeed){fields.push(field('runs','Número de entregas parceladas','number','Use 1 para uma entrega única. A quantidade acima será enviada em cada parcela.','1',{min:1,max:100,defaultValue:1}));fields.push(field('interval','Intervalo entre parcelas, em minutos','number','Aplicado somente quando houver mais de uma parcela.','30',{min:1,max:1440,defaultValue:30}));}
 if(t==='SEO')fields.push(field('keywords','Palavras-chave de busca','textarea','Escreva uma palavra ou expressão por linha. Ex.: receitas fáceis.','receitas fáceis\nalmoço rápido'));
 if(['Custom Comments','Custom Comments Package','Comment Replies'].includes(t))fields.push(field('comments','Comentários que serão enviados','textarea','Escreva exatamente os textos desejados, um por linha. Cada linha corresponde a um comentário.','Gostei muito!\nConteúdo excelente.'));
 if(t==='Mentions Custom List')fields.push(field('usernames','Perfis que serão mencionados','textarea','Um nome de usuário por linha, sem senha. A quantidade será calculada pela lista.','usuario1\nusuario2'));
 if(t==='Mentions Hashtag')fields.push(field('hashtag',/telegram/i.test(s.redeSocial||'')?'Termo de busca':'Hashtag de origem','text','Informe a hashtag ou termo de origem solicitado por esta modalidade.','seutema'));
 if(t==='Mentions User Followers')fields.push(field('username','Link do perfil de origem','url','Os perfis mencionados serão obtidos dos seguidores deste perfil de origem.','https://www.instagram.com/perfilorigem/'));
 if(t==='Comment Likes'||t==='Comment Replies')fields.push(field('username','Usuário que escreveu o comentário','text','Informe o nome de usuário do autor do comentário, sem @. O link acima deve ser o da publicação.','usuario'));
 if(t==='Poll')fields.push(field('answer_number','Número da alternativa da enquete','number','Conte as opções de cima para baixo: 1 é a primeira, 2 a segunda, e assim por diante.','1',{min:1,max:1000}));
 if(t==='Invites from Groups')fields.push(field('groups',/spotify|search|busca/i.test((s.nome||s.nomeOriginal||'')+' '+(s.redeSocial||''))?'Termos de busca ou origens':'Grupos de origem','textarea','Um item por linha. Use as origens ou termos indicados no nome do serviço.','Um item por linha'));
 if(t==='Subscriptions'){
 fields.push(field('username','Nome de usuário do perfil','text','Somente o usuário, sem @, link ou senha.','seuusuario'));
 fields.push(field('posts','Máximo de publicações futuras','number','A automação para quando atingir este limite. A quantidade escolhida acima vale para cada publicação.','3',{min:1,max:100}));
 fields.push(field('old_posts','Publicações antigas para incluir','number','Use 0 para acompanhar somente publicações novas.','0',{min:0,max:100,defaultValue:0}));
 fields.push(field('delay','Espera antes de iniciar cada entrega','select','Tempo contado após identificar a publicação.','',{options:delays.map(function(n){return {value:n,label:n===0?'Sem espera adicional':n+' minutos'};}),defaultValue:0}));
 fields.push(field('expiry','Data final do acompanhamento','date','Após esta data o acompanhamento termina, mesmo que o limite de publicações não tenha sido atingido.'));
 }
 return {supported:true,type:t,target:dest,fields:fields,linkRequired:t!=='Subscriptions',quantity:quantity,derived:derived,package:packageType(s),subscription:t==='Subscriptions',instruction:dest.instruction};
}
function normalize(s,body,clock){
 var spec=describe(s);if(!spec.supported)fail('Modalidade indisponível para compra.');
 var min=Number(s.min),max=Number(s.max);if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min)fail('Limites do serviço inválidos.');
 var params={},q;
 if(spec.linkRequired)params.link=link(body.link,spec.target.label);
 if(spec.quantity)q=integer(body.quantidade==null?body.quantity:body.quantidade,'Quantidade',min,max);
 for(var f of spec.fields){
 var v=body[f.key];
 if(f.input==='textarea'){var list=lines(v,f.label);params[f.key]=list.join('\n');if(spec.derived===f.key)q=list.length;}
 else if(f.input==='number')params[f.key]=integer(v==null&&f.defaultValue!==undefined?f.defaultValue:v,f.label,f.min,f.max);
 else if(f.input==='select'){var n=Number(v==null?f.defaultValue:v);if(!f.options.some(function(o){return o.value===n;}))fail(f.label+' inválida.');params[f.key]=n;}
 else if(f.input==='date'){
 var date=text(v,f.label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('Escolha uma data final válida.');
 var parsed=new Date(date+'T23:59:59Z'),today=clock?new Date(clock):new Date();if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||parsed<=today||parsed>new Date(today.getTime()+366*86400000))fail('A data final deve estar entre hoje e os próximos 366 dias.');
 params.expiry=date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4);
 }else if(f.input==='url')params[f.key]=link(v,f.label);
 else{var value=text(v,f.label,500);if(f.key==='username'){value=value.replace(/^@/,'');if(/[\s/\\]/.test(value))fail('Informe somente o usuário, sem @ ou link.');}params[f.key]=value;}
 }
 if(spec.derived==='package')q=1;
 if(!spec.package)q=integer(q,'Quantidade',min,max);
 if(spec.package&&spec.type==='Custom Comments Package'){
 var pack=String(s.nome||s.nomeOriginal||'').match(/(\d+)\s*(?:comments?|comentários?)/i);if(pack&&lines(params.comments,'Comentários').length!==Number(pack[1]))fail('Este pacote exige '+pack[1]+' comentários, um por linha.');
 }
 if(!spec.package&&!spec.derived&&!spec.subscription)params.quantity=q;
 if(spec.subscription){
 params.min=q;params.max=q;
 var numberOfPosts=params.posts+params.old_posts;if(numberOfPosts>100)fail('Use no máximo 100 publicações no total.'); 
 return {params:params,quantity:q,billableQuantity:q*numberOfPosts,units:numberOfPosts,subscription:true,package:false,link:'https://'+({instagram:'www.instagram.com',tiktok:'www.tiktok.com',youtube:'www.youtube.com'}[String(s.redeSocial||'').toLowerCase()]||'www.instagram.com')+'/'+encodeURIComponent(params.username)};
 }
 var runs=params.runs||1;if(runs===1){delete params.runs;delete params.interval;}return {params:params,quantity:q,billableQuantity:spec.package?1:q*runs,units:spec.package?1:q*runs,subscription:false,package:spec.package,link:params.link};
}
function amount(s,tariff,input){var raw=Number(tariff)*input.billableQuantity*(input.package?100:0.1),cents=raw>0?Math.max(1,Math.round(raw)):0;if(!Number.isSafeInteger(cents)||cents<1||cents>100000000)fail('O total deve ficar entre R$ 0,01 e R$ 1.000.000. Ajuste a quantidade.');return {cents:cents,value:cents/100,qtd:input.quantity};}
return {types:types,describe:describe,normalize:normalize,amount:amount,isPackage:packageType,target:target};
});
