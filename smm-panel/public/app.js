(function(){
  const API_BASE = '';
  const fetch = window.smmFetch;
  const $ = (id) => document.getElementById(id);
  let clienteId = null;
  let clienteNome = '';
  let isRevendedor = false;
  localStorage.removeItem('eng_revSenha'); localStorage.removeItem('eng_apiKey');
  let whatsappSuporte = '';
  let ordemServicos = 'prioridade';
  let filtroCatalogo = 'todos';

  // ===== TOP BAR =====
  function atualizarTopBar(){
    if(clienteId){
      $('auth-hero').classList.add('hidden');
      $('area-logada').classList.remove('hidden');
      $('saudacao').textContent = clienteNome ? `Olá, ${clienteNome}` : 'Logado';
      $('tabs').classList.remove('hidden');
      $('painel-engajar').classList.remove('hidden');
      $('painel-revendedor').classList.add('hidden');
      $('tab-revendedor').classList.toggle('hidden',!isRevendedor);
      carregarSaldo();
      carregarFiltrosIniciais();
      gerarIconesFlutuantesLogado();
    } else {
      $('auth-hero').classList.remove('hidden');
      $('area-logada').classList.add('hidden');
      ['pedidos','carteira','suporte','api','vitrine','revendedor','conta'].forEach(p => $(`painel-${p}`)?.classList.add('hidden'));
    }
  }

  function encerrarSessaoLocal(){
    fecharObjetivos();
    pedidosSuporteCarregados=false;envioTicketPendente=null;rascunhosTickets.clear();ticketsEnviando.clear();enviosConversa.clear();
    localStorage.removeItem('eng_clienteId'); localStorage.removeItem('eng_clienteNome');
    clienteId = null; clienteNome = ''; isRevendedor = false;
    pixManualAtivo=false;pixManualSelecionado=null;pixRevCarregado=false;$('rev-sub-link').value='';$('rev-sub-link-wrap').classList.add('hidden');$('rev-sub-lista').replaceChildren();$('rev-sub-convites').replaceChildren();$('manual-dados').replaceChildren();$('manual-dados').classList.add('hidden');$('recarga-automatica').classList.remove('hidden');$('pix-manual-cliente').classList.add('hidden');$('manual-historico-wrap').classList.add('hidden');
    $('api-key-display').textContent='Nenhuma chave gerada';
    $('api-key-msg').textContent='';
    for(const k of Object.keys(sessionStorage))if(k.startsWith('smm_pending:'))sessionStorage.removeItem(k);
    atualizarTopBar();
    limparDadosConta();$('auth-senha').value='';$('auth-senha-cad').value='';
  }
  $('btn-login-logout').addEventListener('click',async()=>{await fetch('/api/auth-cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'logout'})});encerrarSessaoLocal();});

  // ===== AUTH =====
  $('btn-toggle-cadastro').addEventListener('click', () => { $('bloco-login').classList.add('hidden'); $('bloco-cadastro').classList.remove('hidden'); $('auth-msg').textContent=''; });
  $('btn-toggle-login').addEventListener('click', () => { $('bloco-cadastro').classList.add('hidden'); $('bloco-login').classList.remove('hidden'); $('auth-msg').textContent=''; });

  $('btn-login').addEventListener('click', async () => {
    const loginId = $('auth-login-id').value.trim();
    const senha = $('auth-senha').value;
    if(!loginId || !senha){ msgAuth('Preenche usuário/WhatsApp e senha','erro'); return; }
    const isWhats = /^\d+$/.test(loginId.replace(/[\s\-\(\)]/g,''));
    const payload = isWhats ? {acao:'login',whatsapp:loginId,senha} : {acao:'login',usuario:loginId.toLowerCase(),senha};
    try{
      const r = await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data = await r.json();
      if(!r.ok){ msgAuth(data.erro||'Usuário/WhatsApp ou senha incorretos','erro'); return; }
      clienteId=data.clienteId; clienteNome=data.nome||''; isRevendedor=data.role==='revendedor';
      $('auth-senha').value='';
      $('api-key-display').textContent='Gere uma nova chave para visualizá-la.';
      localStorage.setItem('eng_clienteId',clienteId); localStorage.setItem('eng_clienteNome',clienteNome);
      localStorage.setItem('eng_isRevendedor','false'); localStorage.removeItem('eng_revSenha');
      atualizarTopBar();
    }catch(e){ msgAuth('Erro de conexão','erro'); }
  });

  $('btn-cadastrar').addEventListener('click', async () => {
    const nome=$('auth-nome').value.trim(), usuario=$('auth-usuario').value.trim().toLowerCase().replace(/[^a-z0-9_\.]/g,'');
    const whatsapp=$('auth-whats').value.trim(), senha=$('auth-senha-cad').value, origem=$('auth-origem').value||'nao_informado';
    if(conviteSubrevenda&&!conviteSubValido){msgAuth('Convite indisponível. Peça um novo link à sua revenda.','erro');return;}
    if(!nome){ msgAuth('Informe seu nome','erro'); return; }
    if(!usuario||usuario.length<3){ msgAuth('Usuário deve ter pelo menos 3 caracteres','erro'); return; }
    if(!whatsapp){ msgAuth('Informe seu WhatsApp','erro'); return; }
    if(!senha||senha.length<8){ msgAuth('Senha deve ter pelo menos 8 caracteres','erro'); return; }
    try{
      const r = await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:conviteSubrevenda?'cadastro-subrevendedor':'cadastro',...(conviteSubrevenda?{convite:conviteSubrevenda}:{}),nome,usuario,whatsapp,senha,origem})});
      const data = await r.json();
      if(!r.ok){ msgAuth(data.erro||'Erro ao criar conta','erro'); return; }
      clienteId=data.clienteId; clienteNome=data.nome||'';isRevendedor=data.role==='revendedor';
      if(conviteSubrevenda){conviteSubrevenda='';conviteSubValido=false;history.replaceState(null,'','/app.html');$('sub-convite-msg').classList.add('hidden');$('auth-senha-cad').value='';}
      localStorage.setItem('eng_clienteId',clienteId); localStorage.setItem('eng_clienteNome',clienteNome);
      atualizarTopBar();
    }catch(e){ msgAuth('Erro de conexão','erro'); }
  });

  function msgAuth(texto,tipo){ $('auth-msg').textContent=texto; $('auth-msg').className='auth-msg'+(tipo?' '+tipo:''); }

  // ===== ABAS =====
  function ativarAba(aba){
    ['engajar','pedidos','carteira','suporte','api','vitrine','revendedor','conta'].forEach(a=>{
      $(`tab-${a}`)?.classList.remove('ativa');
      $(`painel-${a}`)?.classList.add('hidden');
    });
    $(`tab-${aba}`)?.classList.add('ativa');
    $(`painel-${aba}`)?.classList.remove('hidden');
  }

  $('tab-revendedor').addEventListener('click',()=>{if(isRevendedor){ativarAba('revendedor');carregarPainelRevendedor();}});
  $('tab-engajar').addEventListener('click',()=>ativarAba('engajar'));
  $('tab-pedidos').addEventListener('click',()=>{ ativarAba('pedidos'); carregarMeusPedidos(); });
  $('tab-carteira').addEventListener('click',()=>{ ativarAba('carteira'); carregarSaldo(); });
  $('tab-suporte').addEventListener('click',()=>{ ativarAba('suporte'); carregarTicketsCliente(); });
  $('tab-api').addEventListener('click',()=>ativarAba('api'));
  $('tab-vitrine').addEventListener('click',()=>{ ativarAba('vitrine'); carregarVitrine(); });
  $('saldo-display').addEventListener('click',()=>{ ativarAba('carteira'); carregarSaldo(); });

  // ===== WIDGET DE ENGAJAMENTO — NOVO VISUAL =====
  let todosServicos = [];
  let redeSelecionada = '';
  let tipoSelecionado = '';
  let servicoSelecionado = null;

  const iconeRede={};
  const logos={"instagram":"instagram","telegram":"telegram","whatsapp":"whatsapp","tiktok":"tiktok","threads":"threads","youtube":"youtube","facebook":"facebook","twitter":"x","spotify":"spotify","kick":"kick","twitch":"twitch","snapchat":"snapchat","soundcloud":"soundcloud","shopee":"shopee","reddit":"reddit","google":"google","discord":"discord","pinterest":"pinterest","clubhouse":"clubhouse","deezer":"deezer","apple music":"applemusic","trustpilot":"trustpilot","line":"line","dailymotion":"dailymotion","quora":"quora","tumblr":"tumblr","tidal":"tidal","shazam":"shazam","vimeo":"vimeo","rumble":"rumble","linkedin":"linkedin","kwai":"kuaishou","apple":"apple","android":"android","bluesky":"bluesky","vk":"vk","medium":"medium","audiomack":"audiomack","mixcloud":"mixcloud","ok.ru":"odnoklassniki","github":"github","napster":"napster","reverbnation":"reverbnation"};
  const brandColors={instagram:'#d94691',tiktok:'#22c5ca',youtube:'#f04444',facebook:'#3984f5',twitter:'#768390',telegram:'#27a7df',spotify:'#23c86b',twitch:'#9560ff',kick:'#62dd21',whatsapp:'#25c875',pinterest:'#e53950',linkedin:'#2685bb',snapchat:'#dfce25',soundcloud:'#f77d2b',discord:'#7981f5'};
  const prettyNames={instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',facebook:'Facebook',twitter:'X / Twitter',telegram:'Telegram',spotify:'Spotify',twitch:'Twitch',kick:'Kick',whatsapp:'WhatsApp',pinterest:'Pinterest',linkedin:'LinkedIn',snapchat:'Snapchat',soundcloud:'SoundCloud',kwai:'Kwai',threads:'Threads',shazam:'Shazam','apple music':'Apple Music',discord:'Discord',clubhouse:'Clubhouse',reddit:'Reddit',quora:'Quora',google:'Google',line:'LINE',dailymotion:'Dailymotion',trustpilot:'Trustpilot','outras plataformas':'Outras plataformas',website:'Sites e páginas'};
  const moeda=valor=>Number(valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const tarifa=valor=>Number(valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:8});
  function capitalizar(s){return prettyNames[s]||(s?s.charAt(0).toUpperCase()+s.slice(1):'');}
  function nomeAmigavel(s){return CatalogText.translate(s);}
  function etapaCompra(etapa){for(const id of ['rede','tipo','servico','pagar']){const el=$('passo-'+id);if(id===etapa)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');}}
  function quantidadeInicial(s){if(OrderForms.isPackage(s))return 1;return Math.min(Number(s.max),Math.max(Number(s.min),Math.ceil(5/Number(s.precoPorMil))));}
  function ordenarServicos(lista){
    const sorted=[...lista];if(ordemServicos==='preco_asc')return sorted.sort((a,b)=>a.precoPorMil-b.precoPorMil);
    if(ordemServicos==='preco_desc')return sorted.sort((a,b)=>b.precoPorMil-a.precoPorMil);
    if(ordemServicos==='novos')return sorted.sort((a,b)=>Number(!!(b.novo||b.novidadeAnunciada))-Number(!!(a.novo||a.novidadeAnunciada))||CatalogText.compare(a,b));
    return sorted.sort(CatalogText.compare);
  }
  function networkLogo(rede){const wrap=document.createElement('span');wrap.className='network-logo';if(logos[rede]){const img=document.createElement('img');img.src='/network-logos/'+logos[rede]+'.svg';img.alt='';img.width=26;img.height=26;wrap.append(img);}else wrap.textContent='🌐';return wrap;}
  let mostrarTodasRedes=false;
  function filtrarRedes(){const search=$('redes-busca').value.trim().toLowerCase();const buttons=[...document.querySelectorAll('.rede-tab')];buttons.forEach((b,i)=>b.hidden=search?!b.textContent.toLowerCase().includes(search):!mostrarTodasRedes&&i>=8);$('redes-mais').hidden=buttons.length<=8||!!search;$('redes-mais').textContent=mostrarTodasRedes?'Mostrar redes principais':'Ver todas as redes ('+buttons.length+')';}
  $('redes-busca').addEventListener('input',filtrarRedes);$('redes-mais').addEventListener('click',()=>{mostrarTodasRedes=!mostrarTodasRedes;filtrarRedes();});
  async function carregarFiltrosIniciais(){
    try{const r=await fetch('/api/services');if(!r.ok)throw Error();const data=await r.json(),el=$('redes-tabs');el.replaceChildren();
      for(const rede of data.redesSociais||[]){const button=document.createElement('button');button.type='button';button.className='rede-tab';button.dataset.rede=rede;button.setAttribute('aria-pressed','false');button.style.setProperty('--network-color',brandColors[rede]||'#52b98c');button.append(networkLogo(rede));const label=document.createElement('span');label.textContent=capitalizar(rede);button.append(label);const count=(data.redes||[]).find(x=>x.nome===rede)?.total;if(count){const small=document.createElement('small');small.textContent=count.toLocaleString('pt-BR')+' opções';button.append(small);}button.addEventListener('click',()=>selecionarRede(rede));el.append(button);}
      filtrarRedes();if(!el.children.length)el.textContent='Nenhuma opção disponível agora. Fale com a equipe em Preciso de ajuda.';
    }catch{$('redes-tabs').textContent='Não foi possível carregar as redes. Atualize a página ou fale com a equipe.';}
  }
  const objetivoInfo={
    'Curtidas':['heart','Dê mais destaque à sua publicação.'],
    'Seguidores e inscritos':['users','Aumente o público do seu perfil ou canal.'],
    'Comentários':['comment','Receba comentários em uma publicação.'],
    'Visualizações':['play','Mais visualizações para seu conteúdo.'],
    'Acompanhamento automático':['repeat','Configure pedidos para suas publicações.'],
    'Alcance e impressões':['chart','Amplie a exposição do seu conteúdo.'],
    'Compartilhamentos':['share','Mais compartilhamentos e republicações.'],
    'Salvamentos':['bookmark','Mais pessoas salvando sua publicação.'],
    'Visitas e tráfego':['link','Direcione visitas ao destino informado.'],
    'Transmissões ao vivo':['live','Opções para sua transmissão ao vivo.'],
    'Stories':['story','Interações e visualizações em stories.'],
    'Membros':['users','Amplie o público do seu grupo ou canal.'],
    'Curtidas em comentários':['heart','Destaque um comentário específico.'],
    'Respostas a comentários':['comment','Adicione respostas a um comentário.'],
    'Menções':['mention','Marque perfis conforme as instruções.'],
    'Pacotes':['package','Compare opções com quantidade definida.'],
    'Votos em enquetes':['chart','Escolha a resposta e a quantidade de votos.'],
    'Reproduções e ouvintes':['play','Mais reproduções para suas faixas.'],
    'Avaliações':['star','Veja as modalidades de avaliação.'],
    'Reações':['heart','Escolha as reações para sua publicação.'],
    'Busca e palavras-chave':['search','Opções de busca com palavras-chave.'],
    'Outros serviços':['spark','Explore outras opções desta rede.']
  };
  const objetivoPaths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',play:'M8 5v14l12-7ZM3 3v18',comment:'M21 11a8 8 0 0 1-8 8H6l-4 3V10a8 8 0 0 1 8-8h3a8 8 0 0 1 8 9ZM7 8h10M7 12h7',repeat:'m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3',chart:'M3 3v18h18M7 16v-4M12 16V8M17 16V4',share:'m9 8 8-4m-8 12 8 4M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0',bookmark:'M5 3h14v19l-7-4-7 4Z',link:'m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',live:'M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M4 4a12 12 0 0 0 0 16M20 4a12 12 0 0 1 0 16M12 11v2',story:'M12 2a10 10 0 1 1-10 10M2 8V4h4M12 6v6l4 2',mention:'M16 8v7a3 3 0 0 0 6 0v-3a10 10 0 1 0-4 8M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',package:'m3 7 9-5 9 5v10l-9 5-9-5ZM3 7l9 5 9-5M12 12v10M7 4l10 5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z'};
  function objetivoIcon(tipo){
    const wrap=document.createElement('span');wrap.className='objetivo-icon';wrap.setAttribute('aria-hidden','true');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',objetivoPaths[(objetivoInfo[tipo]||['spark'])[0]]);svg.append(path);wrap.append(svg);return wrap;
  }
  function fecharObjetivos(){if($('objetivos-modal').open)$('objetivos-modal').close();}
  function abrirObjetivos(){
    $('objetivos-busca').value='';filtrarObjetivos();
    if(typeof $('objetivos-modal').showModal==='function'&&!$('objetivos-modal').open)$('objetivos-modal').showModal();
  }
  function filtrarObjetivos(){const term=$('objetivos-busca').value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');let visible=0;for(const card of $('objetivos-modal-lista').children){card.hidden=!card.textContent.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(term);if(!card.hidden)visible++;}$('objetivos-vazio').hidden=!!visible;}
  $('abrir-objetivos').addEventListener('click',abrirObjetivos);$('fechar-objetivos').addEventListener('click',fecharObjetivos);$('objetivos-busca').addEventListener('input',filtrarObjetivos);
  function renderizarObjetivos(tipos){
    for(const id of ['tipos-chips','objetivos-modal-lista']){
      const list=$(id);list.replaceChildren();
      for(const tipo of tipos){
        const b=document.createElement('button');b.type='button';b.className='tipo-chip objetivo-card';b.dataset.tipo=tipo;b.setAttribute('aria-pressed',String(tipo===tipoSelecionado));b.append(objetivoIcon(tipo));
        const text=document.createElement('span');text.className='objetivo-copy';const title=document.createElement('strong');title.textContent=capitalizar(tipo);const description=document.createElement('span');description.textContent=(objetivoInfo[tipo]||['spark','Confira as opções e instruções disponíveis.'])[1];const count=document.createElement('small');count.textContent=todosServicos.filter(s=>s.servicoTipo===tipo).length.toLocaleString('pt-BR')+' opções disponíveis';text.append(title,description,count);b.append(text);b.addEventListener('click',()=>{fecharObjetivos();selecionarTipo(tipo);});list.append(b);
      }
    }
  }
  async function selecionarRede(rede){
    redeSelecionada=rede;tipoSelecionado='';servicoSelecionado=null;etapaCompra('tipo');
    document.querySelectorAll('.rede-tab').forEach(b=>{b.classList.toggle('ativa',b.dataset.rede===rede);b.setAttribute('aria-pressed',String(b.dataset.rede===rede));});
    $('painel-tipos').classList.remove('hidden');$('painel-servicos-lista').classList.add('hidden');$('painel-form-pedido').classList.add('hidden');$('rede-selecionada-label').textContent=capitalizar(rede);$('tipos-chips').textContent='Carregando objetivos…';
    try{const r=await fetch('/api/services?redeSocial='+encodeURIComponent(rede));if(!r.ok)throw Error();const data=await r.json();if(redeSelecionada!==rede)return;todosServicos=(data.servicos||[]).map(s=>({...s,redeSocial:rede}));const tipos=[...new Set(todosServicos.map(s=>s.servicoTipo).filter(Boolean))].sort((a,b)=>Object.keys(objetivoInfo).indexOf(a)-Object.keys(objetivoInfo).indexOf(b));renderizarObjetivos(tipos);$('objetivos-modal-rede').textContent=capitalizar(rede);if(tipos.length)abrirObjetivos();else $('tipos-chips').textContent='Não há opções nesta rede. Escolha outra rede.';$('painel-tipos').scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch{if(redeSelecionada===rede)$('tipos-chips').textContent='Não foi possível carregar as opções. Tente selecionar a rede novamente.';}
  }
  let limiteServicos=20;
  function selecionarTipo(tipo){
    tipoSelecionado=tipo;servicoSelecionado=null;etapaCompra('servico');limiteServicos=20;
    filtroCatalogo='todos';document.querySelectorAll('[data-catalog-filter]').forEach(b=>{b.classList.toggle('ativo',b.dataset.catalogFilter==='todos');b.setAttribute('aria-pressed',String(b.dataset.catalogFilter==='todos'));});
    document.querySelectorAll('.tipo-chip').forEach(b=>(b.classList.toggle('ativo',b.dataset.tipo===tipo),b.setAttribute('aria-pressed',String(b.dataset.tipo===tipo))));
    $('tipo-selecionado-label').textContent=capitalizar(tipo);$('servico-busca').value='';$('servico-categoria').replaceChildren();
    const all=document.createElement('option');all.value='';all.textContent='Todas as categorias';$('servico-categoria').append(all);
    const categorias=[...new Set(todosServicos.filter(s=>s.servicoTipo===tipo).map(s=>s.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));for(const categoria of categorias){const op=document.createElement('option');op.value=categoria;op.textContent=categoria;$('servico-categoria').append(op);}
    $('painel-servicos-lista').classList.remove('hidden');$('painel-form-pedido').classList.add('hidden');renderizarServicos();
  }
  function renderizarServicos(){
    const search=$('servico-busca').value.toLocaleLowerCase('pt-BR').trim(),category=$('servico-categoria').value;
    const filtered=ordenarServicos(todosServicos.filter(s=>s.servicoTipo===tipoSelecionado&&(filtroCatalogo==='todos'||(filtroCatalogo==='reais'&&s.reaisAnunciados)||(filtroCatalogo==='novos'&&(s.novo||s.novidadeAnunciada)))&&(!category||s.categoria===category)&&(!search||(s.nome+' '+s.categoria+' '+s.id).toLocaleLowerCase('pt-BR').includes(search))));
    const list=$('servicos-lista');list.replaceChildren();
    for(const s of filtered.slice(0,limiteServicos)){
      const card=document.createElement('button');card.type='button';card.className='servico-card';card.dataset.id=s.id;card.setAttribute('aria-pressed','false');
      const spec=OrderForms.describe(s),amount=Math.max(0.01,Math.round(s.precoPorMil*(spec.package?100:quantidadeInicial(s)/10))/100);
      const unit=spec.package?'pelo pacote':spec.subscription?'por publicação (quantidade inicial)':'por '+quantidadeInicial(s).toLocaleString('pt-BR')+' unidades';
      card.innerHTML=safeHTML('<span class="service-category">'+escapeHTML(s.categoria||tipoSelecionado)+'</span><span class="servico-card-top"><span class="servico-card-nome">'+escapeHTML(nomeAmigavel(s.nome))+'</span></span><span class="service-badges">'+(s.reaisAnunciados?'<span>✦ Reais anunciados</span>':'')+(s.novo?'<span>✧ Adicionado recentemente</span>':s.novidadeAnunciada?'<span>✧ Novidade anunciada</span>':'')+(s.refill?'<span>↻ Reposição</span>':'')+(s.cancel?'<span>Cancelamento disponível</span>':'')+'</span><span class="service-price">'+escapeHTML(moeda(amount))+' <small>'+escapeHTML(unit)+'</small></span><span class="service-open">Ver instruções e fazer pedido →</span>');
      card.addEventListener('click',()=>selecionarServico(s));list.append(card);
    }
    $('servicos-contagem').textContent=filtered.length?'Mostrando '+Math.min(limiteServicos,filtered.length)+' de '+filtered.length.toLocaleString('pt-BR')+' opções':'Nenhuma opção encontrada. Limpe a busca ou escolha outra categoria.';
    $('servicos-mais').hidden=filtered.length<=limiteServicos;
  }
  for(const id of ['servico-busca','servico-categoria','servico-ordem'])$(id).addEventListener(id==='servico-busca'?'input':'change',()=>{limiteServicos=20;ordemServicos=$('servico-ordem').value;renderizarServicos();});
  document.querySelectorAll('[data-catalog-filter]').forEach(button=>button.addEventListener('click',()=>{filtroCatalogo=button.dataset.catalogFilter;limiteServicos=20;document.querySelectorAll('[data-catalog-filter]').forEach(b=>{b.classList.toggle('ativo',b===button);b.setAttribute('aria-pressed',String(b===button));});renderizarServicos();}));
  $('servicos-mais').addEventListener('click',()=>{limiteServicos+=20;renderizarServicos();});
  function dadosDoPedido(){
    const body={link:$('eng-link').value.trim(),quantidade:$('eng-qtd').value,comments:$('eng-comments').value};
    document.querySelectorAll('[data-pedido-field]').forEach(el=>body[el.dataset.pedidoField]=el.value);
    const normalized=OrderForms.normalize(servicoSelecionado,body);
    return {...body,idFornecedor:servicoSelecionado.id,quantidade:normalized.quantity,...(normalized.link?{link:normalized.link}:{})};
  }
  function selecionarServico(s){
    servicoSelecionado=s;etapaCompra('pagar');
    document.querySelectorAll('.servico-card').forEach(c=>{const active=String(c.dataset.id)===String(s.id);c.classList.toggle('selecionado',active);c.setAttribute('aria-pressed',String(active));});
    const spec=OrderForms.describe(s),dest=spec.target;
    $('servico-nome-display').textContent=nomeAmigavel(s.nome);$('servico-info-display').textContent=spec.package?tarifa(s.precoPorMil)+' pelo pacote':tarifa(s.precoPorMil)+' por 1.000'+(spec.subscription?', por publicação':'');
    $('eng-instrucao').textContent=spec.instruction;$('eng-instrucao').style.display='block';
    $('eng-caracteristicas').textContent=(s.descricao?nomeAmigavel(s.descricao)+'\n\n':'')+'Categoria: '+(s.categoria||s.servicoTipo)+'. '+(s.refill?'Reposição disponível. ':'')+(s.cancel?'Permite solicitar cancelamento. ':'')+'Prazos e características indicados no nome são estimativas anunciadas; não garantem resultado ou horário exato.';
    $('eng-link-wrap').classList.toggle('hidden',!spec.linkRequired);$('eng-link-label').textContent=dest.label;$('eng-link').placeholder=dest.example;$('eng-link').value='';
    $('eng-qtd-wrap').classList.toggle('hidden',!spec.quantity);$('eng-qtd-label').textContent=spec.subscription?'Quantidade para cada publicação':'Quantidade desejada';
    $('eng-qtd').min=s.min;$('eng-qtd').max=s.max;$('eng-qtd').value=quantidadeInicial(s);$('eng-qtd-ajuda').textContent='Escolha entre '+s.min.toLocaleString('pt-BR')+' e '+s.max.toLocaleString('pt-BR')+(spec.subscription?' por publicação.':' unidades.');
    $('eng-validacao').textContent='';$('eng-msg').textContent='';$('eng-resultado').classList.add('hidden');$('eng-campos-extra').replaceChildren();$('eng-comments').value='';
    const comment=spec.fields.find(f=>f.key==='comments');$('eng-comments-wrap').classList.toggle('hidden',!comment);
    if(comment){$('eng-comments-label').textContent=comment.label;$('eng-comments-ajuda').textContent=comment.help+(spec.package?' Confira a quantidade de textos informada no nome do pacote.':' Mínimo: '+s.min+'; máximo: '+s.max.toLocaleString('pt-BR')+'.');}
    for(const field of spec.fields.filter(f=>f.key!=='comments')){
      const wrap=document.createElement('div'),label=document.createElement('label');label.className='label';label.htmlFor='pedido-'+field.key;label.textContent=field.label;wrap.append(label);
      const input=document.createElement(field.input==='textarea'?'textarea':field.input==='select'?'select':'input');input.className=field.input==='select'?'select':'input';if(!['textarea','select'].includes(field.input))input.type=field.input;input.id='pedido-'+field.key;input.dataset.pedidoField=field.key;input.required=field.required;
      if(field.placeholder)input.placeholder=field.placeholder;if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;
      if(field.input==='number'){input.step='1';input.inputMode='numeric';}
      if(field.input==='textarea')input.rows=4;
      if(field.options)for(const option of field.options){const op=document.createElement('option');op.value=option.value;op.textContent=option.label;input.append(op);}
      if(field.defaultValue!==undefined)input.value=field.defaultValue;
      if(field.key==='posts')input.value=1;
      if(field.input==='date'){const date=new Date();date.setDate(date.getDate()+30);input.value=date.toISOString().slice(0,10);input.min=new Date().toISOString().slice(0,10);}
      const help=document.createElement('p');help.id='pedido-ajuda-'+field.key;help.className='preco-detalhe';help.textContent=field.help;input.setAttribute('aria-describedby',help.id);wrap.append(input,help);input.addEventListener('input',atualizarPreco);input.addEventListener('change',atualizarPreco);$('eng-campos-extra').append(wrap);
    }
    $('eng-quantidades').replaceChildren();if(spec.quantity)for(const q of [...new Set([quantidadeInicial(s),100,500,1000])].filter(q=>q>=s.min&&q<=s.max).sort((a,b)=>a-b)){const b=document.createElement('button');b.type='button';b.textContent=q.toLocaleString('pt-BR');b.addEventListener('click',()=>{$('eng-qtd').value=q;atualizarPreco();});$('eng-quantidades').append(b);}
    $('painel-form-pedido').classList.remove('hidden');$('painel-form-pedido').scrollIntoView({behavior:'smooth',block:'start'});atualizarPreco(false);
  }
  $('btn-voltar-servicos').addEventListener('click',()=>{etapaCompra('servico');$('painel-form-pedido').classList.add('hidden');$('painel-servicos-lista').scrollIntoView({behavior:'smooth',block:'start'});});
  function atualizarPreco(show){
    $('eng-resultado').classList.add('hidden');$('eng-validacao').textContent='';if(!servicoSelecionado)return false;
    try{const body=dadosDoPedido(),normalized=OrderForms.normalize(servicoSelecionado,body),price=OrderForms.amount(servicoSelecionado,servicoSelecionado.precoPorMil,normalized);
      const summary=normalized.package?'1 pacote':normalized.subscription?normalized.quantity.toLocaleString('pt-BR')+' por publicação; até '+normalized.units+' publicações (novas e antigas)':normalized.quantity.toLocaleString('pt-BR')+' unidades';
      $('eng-resumo').textContent='Confira: '+summary+' em '+capitalizar(redeSelecionada)+'. Destino: '+(normalized.params.username||normalized.link)+'.'+(normalized.subscription?' Compra limitada, sem renovação automática.':'');
      $('eng-preco').textContent=moeda(price.value);$('eng-resultado').classList.remove('hidden');return true;
    }catch(e){if(show!==false)$('eng-validacao').textContent=e.message;return false;}
  }
  for(const id of ['eng-link','eng-qtd','eng-comments'])$(id).addEventListener('input',atualizarPreco);
  function msgEng(texto,tipo){$('eng-msg').textContent=texto||'';$('eng-msg').className='msg'+(tipo?' '+tipo:'');}

  // ===== PAGAMENTOS =====
  let saldoAtual=0;

  async function carregarSaldo(){
    if(!clienteId) return;
    try{
      const r=await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`);
      const data=await r.json();
      saldoAtual=Number(data.saldo||0);
      $('saldo-display').textContent=`💰 R$ ${saldoAtual.toFixed(2)}`;
      if($('saldo-carteira')) $('saldo-carteira').textContent=`R$ ${saldoAtual.toFixed(2)}`;
      await carregarPixManualCliente();
    }catch(e){}
  }

  $('deposito-btn').addEventListener('click', async()=>{
    await carregarPixManualCliente();if(pixManualAtivo){$('deposito-msg').textContent='Use os dados do PIX manual abaixo.';return;}
    const valor=Number($('deposito-valor').value);
    if(!valor||valor<Number($('deposito-valor').min||5)){ $('deposito-msg').textContent='Valor mínimo: '+brl($('deposito-valor').min||5); $('deposito-msg').className='msg erro'; return; }
    $('deposito-btn').disabled=true; $('deposito-msg').textContent='Gerando PIX...';
    try{
      const r=await fetch(`${API_BASE}/api/carteira`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId,valor})});
      const data=await r.json();
      if(!r.ok){ $('deposito-msg').textContent=data.erro||'Erro'; $('deposito-msg').className='msg erro'; $('deposito-btn').disabled=false; return; }
      const qrDiv=$('deposito-qr');
      qrDiv.innerHTML=safeHTML(`<p style="font-size:13px;color:var(--muted);margin:0 0 12px;">Escaneie ou copie o código PIX</p>
        ${data.qrCodeBase64?`<img src="data:image/png;base64,${data.qrCodeBase64}" style="width:180px;height:180px;border-radius:12px;margin-bottom:12px;display:block;margin:0 auto 12px;">`:''}
        ${data.qrCode?`<textarea style="width:100%;background:#0e1013;border:1px solid var(--line);color:var(--accent);padding:10px;border-radius:8px;font-size:11px;resize:none;height:60px;" readonly>${data.qrCode}</textarea>
        <button class="btn" style="margin-top:8px;" data-copy-code data-code="${data.qrCode}">📋 Copiar código PIX</button>`:''}
        <p style="font-size:12px;color:var(--muted);margin-top:12px;">Valor: <strong style="color:var(--accent)">R$ ${Number(data.valor).toFixed(2)}</strong></p>`);
      qrDiv.style.display='block';
      $('deposito-msg').textContent='PIX gerado!'; $('deposito-msg').className='msg ok';
    }catch(e){ $('deposito-msg').textContent='Erro de conexão.'; $('deposito-msg').className='msg erro'; }
    $('deposito-btn').disabled=false;
  });

  $('eng-pagar-saldo').addEventListener('click', async()=>{
    if(!servicoSelecionado||!clienteId) return;
    if(!atualizarPreco())return;
    const qtd=Number($('eng-qtd').value);
    const valorTotal=OrderForms.amount(servicoSelecionado,servicoSelecionado.precoPorMil,OrderForms.normalize(servicoSelecionado,dadosDoPedido())).value;
    try{ const rS=await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`); const dS=await rS.json(); saldoAtual=Number(dS.saldo||0); $('saldo-display').textContent=`💰 R$ ${saldoAtual.toFixed(2)}`; }catch(e){}
    if(saldoAtual<valorTotal){ msgEng(`Saldo insuficiente (R$ ${saldoAtual.toFixed(2)}). Recarregue na aba Carteira.`,'erro'); return; }
    $('eng-pagar-saldo').disabled=true; msgEng('Processando com saldo...');
    try{
      const r=await fetch(`${API_BASE}/api/order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dadosDoPedido(),clienteId,pagarComSaldo:true})});
      const data=await r.json();
      if(!r.ok){ msgEng(data.erro||'Erro','erro'); $('eng-pagar-saldo').disabled=false; return; }
      saldoAtual=data.novoSaldo||0; $('saldo-display').textContent=`💰 R$ ${saldoAtual.toFixed(2)}`;
      msgEng(data.status==='executando'?`Pedido enviado. Saldo: R$ ${saldoAtual.toFixed(2)}`:data.status==='estornado'?'Fornecedor recusou o pedido. Saldo estornado.':'Pedido registrado: '+formatarStatus(data.status)+'. Acompanhe em Pedidos.',data.status==='executando'?'ok':'erro');
    }catch(e){ msgEng('Erro de conexão.','erro'); }
    $('eng-pagar-saldo').disabled=false;
  });

  $('eng-pagar-pix').addEventListener('click', async()=>{
    if(!servicoSelecionado||!clienteId){ msgEng('Faça login pra continuar.','erro'); return; }
    if(!atualizarPreco())return;
    await carregarPixManualCliente();if(pixManualAtivo){ativarAba('carteira');$('manual-valor').value=Math.max(pixManualMinimo,OrderForms.amount(servicoSelecionado,servicoSelecionado.precoPorMil,OrderForms.normalize(servicoSelecionado,dadosDoPedido())).value).toFixed(2);$('manual-msg').textContent='Recarregue o saldo com seu vendedor. Após a aprovação, volte ao pedido e pague com saldo.';return;}
    $('eng-pagar-pix').disabled=true; msgEng('Criando pedido...');
    try{
      const r=await fetch(`${API_BASE}/api/order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dadosDoPedido(),clienteId,pagarComSaldo:false})});
      const data=await r.json();
      if(!r.ok){ msgEng(data.erro||'Erro ao criar pedido','erro'); $('eng-pagar-pix').disabled=false; return; }
      msgEng('Gerando PIX...');
      const rP=await fetch(`${API_BASE}/api/pagamento`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pedidoId:data.pedidoId})});
      const pix=await rP.json();
      if(!rP.ok){ msgEng(pix.erro||'Erro ao gerar PIX.','erro'); $('eng-pagar-pix').disabled=false; return; }
      let qrHtml=`<div style="text-align:center;padding:20px 0;border-top:1px solid var(--line);margin-top:16px;"><p style="font-size:13px;color:var(--muted);margin:0 0 12px;">📱 Escaneie o QR Code ou copie o PIX</p>`;
      if(pix.qrCodeBase64) qrHtml+=`<img src="data:image/png;base64,${pix.qrCodeBase64}" style="width:180px;height:180px;border-radius:12px;margin-bottom:12px;display:block;margin:0 auto 12px;">`;
      if(pix.qrCode) qrHtml+=`<textarea style="width:100%;background:#0e1013;border:1px solid var(--line);color:var(--accent);padding:10px;border-radius:8px;font-size:11px;resize:none;height:60px;" readonly>${pix.qrCode}</textarea><button class="btn" style="margin-top:8px;" data-copy-code data-code="${pix.qrCode}">📋 Copiar código PIX</button>`;
      qrHtml+=`<p style="font-size:12px;color:var(--muted);margin-top:12px;">Valor: <strong style="color:var(--accent)">R$ ${Number(data.valorTotal).toFixed(2)}</strong></p></div>`;
      let qrC=document.getElementById('pix-qr-container');
      if(!qrC){ qrC=document.createElement('div'); qrC.id='pix-qr-container'; $('eng-pagar-pix').closest('.card').appendChild(qrC); }
      qrC.innerHTML=safeHTML(qrHtml);
      msgEng('PIX gerado!','ok');
    }catch(e){ msgEng('Erro de conexão.','erro'); }
    $('eng-pagar-pix').disabled=false;
  });

  // ===== VITRINE =====
  async function carregarVitrine(){
    $('vitrine-msg').textContent='Carregando...';
    try{
      const r=await fetch(`${API_BASE}/api/config?action=vitrine`);
      const data=await r.json();
      $('vitrine-msg').textContent='';
      const cont=$('vitrine-conteudo');
      cont.innerHTML=safeHTML('');
      if(!data.produtos||data.produtos.length===0){
        $('vitrine-msg').textContent='Nenhum produto disponível no momento.';
        return;
      }
      data.produtos.forEach(p=>{
        const div=document.createElement('div');
        div.className='vitrine-card';
        div.innerHTML=safeHTML(`
          ${p.imagemUrl?`<img class="vitrine-img" src="${escapeHTML(p.imagemUrl)}" alt="${escapeHTML(p.nome)}">`:''}
          <div class="vitrine-body">
            <div class="vitrine-nome">${escapeHTML(p.nome||'')}</div>
            <div class="vitrine-desc">${escapeHTML(p.descricao||'')}</div>
            <div class="vitrine-preco">${escapeHTML(p.preco||'')}</div>
            ${p.linkContato?`<a class="vitrine-btn" href="${escapeHTML(p.linkContato)}" target="_blank">📲 Quero esse</a>`:''}
          </div>`);
        cont.appendChild(div);
      });
    }catch(e){ $('vitrine-msg').textContent='Erro ao carregar vitrine.'; }
  }

  // ===== PEDIDOS =====
  let intervaloPedidos=null;

  async function carregarMeusPedidos(){
    if(!clienteId) return;
    try{
      const r=await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data=await r.json();
      const lista=$('lista-pedidos'); lista.innerHTML=safeHTML('');
      if(!data.pedidos||data.pedidos.length===0){ $('pedidos-msg').textContent='Você ainda não fez nenhum pedido.'; return; }
      $('pedidos-msg').textContent='';
      const emAndamento=(data.pedidos||[]).filter(p=>p.orderIdFornecedor&&(p.status==='executando'||(p.cancelamento&&['cancelado','parcial'].includes(p.status)&&!['creditado','sem_valor'].includes(p.cancelamento.reembolsoEstado))));
      await Promise.all(emAndamento.map(p=>fetch(`${API_BASE}/api/pedidos?pedidoId=${escapeHTML(encodeURIComponent(p.id))}`).catch(()=>{})));
      const r2=await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data2=await r2.json();
      if((data2.pedidos||data.pedidos).some(p=>p.cancelamento?.reembolsoEstado==='creditado')) await carregarSaldo();
      (data2.pedidos||data.pedidos).forEach(p=>{
        const restamValidos=p.restam!==null&&p.restam!==undefined&&String(p.restam).trim()!==''&&Number.isFinite(Number(p.restam))&&Number(p.restam)>=0&&Number(p.restam)<=Number(p.quantidade);
        const progresso=p.status==='concluido'?100:restamValidos&&Number(p.quantidade)>0?Math.max(0,Math.min(100,Math.round((1-Number(p.restam)/Number(p.quantidade))*100))):0;
        const corStatus={aguardando_pagamento:'#8b929b',executando:'#ffc97c',concluido:'#7CFFB2',cancelado:'#ff8b8b',erro_fornecedor:'#ff8b8b'};
        const cor=corStatus[p.status]||'#8b929b';
        const div=document.createElement('div'); div.className='pedido-item';
        div.innerHTML=safeHTML(`
          <div class="pedido-top"><span>${escapeHTML(nomeAmigavel(p.nomeServico||'Serviço'))}</span><span class="status-pill ${escapeHTML(p.status)}">${escapeHTML(formatarStatus(p.status))}</span></div>
          <div class="pedido-sub">${p.numeroPedido?`<strong style="color:var(--accent)">${escapeHTML(p.numeroPedido)}</strong> · `:''}Qtd: ${escapeHTML(p.quantidade)} · R$ ${escapeHTML(Number(p.valorTotal).toFixed(2))} · ${escapeHTML(new Date(p.criadoEm).toLocaleDateString('pt-BR'))}${escapeHTML(p.pagamento==='saldo'?' · 💰 Saldo':'')}</div>
          ${p.link?`<div style="font-size:11.5px;margin-top:4px;"><a href="${escapeHTML(p.link)}" target="_blank" style="color:var(--muted);text-decoration:none;">🔗 ${escapeHTML(p.link.length>50?p.link.slice(0,50)+'...':p.link)}</a></div>`:''}
          ${p.status==='executando'||p.status==='concluido'?`<div style="margin-top:8px;"><div style="height:4px;background:var(--line);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${progresso}%;background:${cor};border-radius:4px;transition:width .5s;"></div></div><div style="font-size:11px;color:var(--muted);margin-top:4px;">${progresso}% concluído${restamValidos?` · ${escapeHTML(p.restam)} restando`:''}</div></div>`:''}`);
        const cancel=p.cancelamento;
        if(cancel){
          const notice=document.createElement('p'); notice.className='pedido-cancelamento-msg'; notice.setAttribute('role','status');
          notice.textContent=cancel.reembolsoEstado==='creditado'?'Cancelamento confirmado. R$ '+(Number(cancel.reembolsoCentavos)/100).toFixed(2).replace('.',',')+' devolvidos ao seu saldo.':
            cancel.reembolsoEstado==='revisao'?'Cancelamento confirmado. A devolução está em análise pelo suporte.':
            cancel.reembolsoEstado==='sem_valor'?'Pedido finalizado. Não há valor de serviços não entregues para devolver.':
            p.status==='concluido'?'O pedido foi concluído pelo fornecedor antes do cancelamento.':
            cancel.estado==='recusado'?'O fornecedor recusou a solicitação de cancelamento. Se precisar, fale com o suporte.':
            cancel.estado==='incerto'||cancel.estado==='enviando'?'A solicitação está em conferência. Atualize o pedido para acompanhar; ainda não há cancelamento confirmado.':
            'Cancelamento solicitado. Aguardando confirmação do fornecedor.';
          div.appendChild(notice);
        } else if(p.podeSolicitarCancelamento){
          const button=document.createElement('button'); button.type='button'; button.className='btn-cancelar-pedido'; button.textContent='Solicitar cancelamento';
          button.setAttribute('aria-label','Solicitar cancelamento do pedido '+(p.numeroPedido||''));
          button.addEventListener('click',async()=>{
            if(!confirm('Solicitar o cancelamento deste pedido? O fornecedor precisa aceitar. Após a confirmação, o valor da parte não entregue será devolvido ao saldo do painel.'))return;
            button.disabled=true; button.textContent='Enviando solicitação...';
            try{
              const response=await fetch(API_BASE+'/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'solicitar-cancelamento',pedidoId:p.id})});
              const result=await response.json();
              if(!response.ok)throw new Error(result.erro||'Não foi possível solicitar o cancelamento.');
              await carregarMeusPedidos();
              await carregarSaldo();
            }catch(error){$('pedidos-msg').textContent=error.message||'Falha de conexão. Atualize os pedidos para conferir a solicitação.';button.disabled=false;button.textContent='Solicitar cancelamento';}
          });
          div.appendChild(button);
        } else if(p.status==='executando'){
          const notice=document.createElement('p');notice.className='pedido-cancelamento-msg';notice.textContent='Este serviço não oferece cancelamento pelo fornecedor.';div.appendChild(notice);
        }
        lista.appendChild(div);
      });
    }catch(e){ $('pedidos-msg').textContent='Erro ao carregar pedidos.'; }
  }

  function iniciarAtualizacaoPedidos(){
    if(intervaloPedidos) clearInterval(intervaloPedidos);
    intervaloPedidos=setInterval(()=>{ if(!$('painel-pedidos').classList.contains('hidden')) carregarMeusPedidos(); },30000);
  }

  $('btn-atualizar-pedidos').addEventListener('click',()=>{
    $('btn-atualizar-pedidos').textContent='⏳ Atualizando...'; $('btn-atualizar-pedidos').disabled=true;
    carregarMeusPedidos().then(()=>{ $('btn-atualizar-pedidos').textContent='🔄 Atualizar'; $('btn-atualizar-pedidos').disabled=false; });
  });

  function formatarStatus(s){ return {aguardando_pagamento:'Aguardando pagamento',executando:'Em andamento',concluido:'Concluído',cancelado:'Cancelado',erro_fornecedor:'Recusado pelo fornecedor',pago:'Pago — aguardando envio',enviando:'Enviando ao fornecedor',processando_saldo:'Processando saldo',revisao_fornecedor:'Em conferência pelo suporte',estorno_pix_pendente:'Estorno PIX em processamento',estornado:'Estornado',saldo_insuficiente:'Não pago — saldo insuficiente',parcial:'Concluído parcialmente'}[s]||s; }

  // ===== SUPORTE =====
  let pedidosSuporteCarregados=false,envioTicketPendente=null;
  const rascunhosTickets=new Map(),ticketsEnviando=new Set(),enviosConversa=new Map();
  function operacaoTicket(){return crypto.randomUUID();}
  async function carregarPedidosSuporte(){
    if(pedidosSuporteCarregados||!clienteId)return;
    try{const r=await fetch(API_BASE+'/api/pedidos?clienteId='+encodeURIComponent(clienteId));if(!r.ok)return;const data=await r.json(),select=$('ticket-pedido');const prior=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Outra dúvida / informar o número na mensagem';select.append(empty);for(const p of data.pedidos||[]){const option=document.createElement('option');option.value=p.id;option.textContent=(p.numeroPedido||'Pedido')+' · '+nomeAmigavel(p.nomeServico||'Serviço')+' · '+formatarStatus(p.status);select.append(option);}select.value=prior;pedidosSuporteCarregados=true;}catch{}
  }
  $('ticket-enviar').addEventListener('click',async()=>{
    const mensagem=$('ticket-mensagem').value.trim(),pedidoId=$('ticket-pedido').value||null;if(!mensagem){$('ticket-msg').textContent='Escreva sua dúvida para enviar.';return;}
    if(!envioTicketPendente||envioTicketPendente.mensagem!==mensagem||envioTicketPendente.pedidoId!==pedidoId)envioTicketPendente={mensagem,pedidoId,requestId:operacaoTicket()};
    $('ticket-enviar').disabled=true;$('ticket-msg').textContent='Recebendo sua pergunta e conferindo os dados…';
    try{const r=await fetch(API_BASE+'/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envioTicketPendente)});const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível enviar.');$('ticket-msg').textContent=data.resposta?'Pergunta recebida. Veja a resposta na conversa abaixo.':'Pergunta recebida. Você pode acompanhar a resposta abaixo.';$('ticket-msg').className='msg ok';$('ticket-mensagem').value='';envioTicketPendente=null;await carregarTicketsCliente();}
    catch(error){$('ticket-msg').textContent=error.message||'Falha de conexão. Atualize as conversas antes de tentar novamente.';$('ticket-msg').className='msg erro';}
    finally{$('ticket-enviar').disabled=false;}
  });
  function mensagemTicket(container,autor,texto,at){
    const box=document.createElement('div');box.className='ticket-message ticket-message-'+autor;const label=document.createElement('strong');label.textContent=autor==='cliente'?'Você':autor==='assistente'?'Assistente automático':'Equipe de suporte';const content=document.createElement('p');content.textContent=texto;box.append(label,content);if(at){const stamp=document.createElement('small');stamp.textContent=new Date(at).toLocaleString('pt-BR');box.append(stamp);}container.append(box);
  }
  async function acaoTicket(id,action,mensagem){
    ticketsEnviando.add(id);const pending=enviosConversa.get(id);const requestId=pending?.mensagem===mensagem&&pending?.action===action?pending.requestId:operacaoTicket();enviosConversa.set(id,{requestId,mensagem,action});
    try{const r=await fetch(API_BASE+'/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,action,...(mensagem?{mensagem}:{}),requestId})});const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível enviar.');enviosConversa.delete(id);if(mensagem)rascunhosTickets.delete(id);await carregarTicketsCliente();}
    catch(error){$('tickets-cliente-msg').textContent=error.message||'Falha de conexão. Atualize a conversa para conferir se sua pergunta foi recebida.';}
    finally{ticketsEnviando.delete(id);document.querySelectorAll('[data-ticket-action]').forEach(b=>{b.disabled=false;if(b.textContent==='Conferindo…')b.textContent='Enviar pergunta';});}
  }
  async function carregarTicketsCliente(){
    if(!clienteId)return;carregarPedidosSuporte();
    try{const r=await fetch(API_BASE+'/api/tickets?clienteId='+encodeURIComponent(clienteId));if(!r.ok)throw Error();const data=await r.json(),lista=$('lista-tickets');lista.replaceChildren();if(!data.tickets?.length){$('tickets-cliente-msg').textContent='Nenhuma conversa ainda. Envie sua primeira pergunta acima.';return;}$('tickets-cliente-msg').textContent='';
      for(const t of data.tickets){
        const div=document.createElement('article');div.className='pedido-item support-thread';
        const header=document.createElement('div');header.className='pedido-top';const title=document.createElement('strong');title.textContent=t.consultaPedido?.pedido?.numero||'Conversa de suporte';const state=document.createElement('span');state.className='status-pill';state.textContent=t.status==='resolvido'?'Resolvido':t.humanoAtivo?'Aguardando equipe':t.atendimento==='aguardando_cliente'?'Respondido':t.atendimento==='analisando'?'Conferindo dados':'Recebido';header.append(title,state);div.append(header);
        const history=document.createElement('div');history.className='ticket-history';const messages=Array.isArray(t.mensagens)?t.mensagens.filter(Boolean):Object.values(t.mensagens||{}).filter(Boolean);
        if(messages.length)for(const m of messages)mensagemTicket(history,m.autor==='cliente'?'cliente':m.autor==='assistente'?'assistente':'equipe',m.texto,m.criadoEm);
        else{mensagemTicket(history,'cliente',t.mensagem,t.criadoEm);if(t.resposta)mensagemTicket(history,'equipe',t.resposta,t.respondidoEm);}
        div.append(history);
        if(t.status!=='resolvido'){
          const label=document.createElement('label');label.className='label';label.htmlFor='ticket-reply-'+t.id;label.textContent='Continuar esta conversa';const input=document.createElement('textarea');input.className='input';input.id=label.htmlFor;input.rows=3;input.maxLength=5000;input.placeholder='Acrescente uma dúvida ou detalhe…';input.value=rascunhosTickets.get(t.id)||'';input.addEventListener('input',()=>rascunhosTickets.set(t.id,input.value));
          const actions=document.createElement('div');actions.className='ticket-actions';const send=document.createElement('button');send.type='button';send.className='btn-sec';send.textContent='Enviar pergunta';send.dataset.ticketAction=t.id;send.disabled=ticketsEnviando.has(t.id);send.addEventListener('click',()=>{if(!input.value.trim())return;send.disabled=true;send.textContent='Conferindo…';acaoTicket(t.id,'continuar',input.value.trim());});actions.append(send);
          if(!t.humanoAtivo){const human=document.createElement('button');human.type='button';human.className='btn-sec';human.textContent='Falar com a equipe';human.dataset.ticketAction=t.id;human.disabled=ticketsEnviando.has(t.id);human.addEventListener('click',()=>{human.disabled=true;acaoTicket(t.id,'pedir-humano');});actions.append(human);}
          if(['aguardando','analisando'].includes(t.atendimento)&&!t.humanoAtivo){const retry=document.createElement('button');retry.type='button';retry.className='btn-sec';retry.textContent='Conferir resposta';retry.dataset.ticketAction=t.id;retry.addEventListener('click',()=>{retry.disabled=true;acaoTicket(t.id,'reconsultar');});actions.append(retry);}
          div.append(label,input,actions);
        }
        lista.append(div);
      }
    }catch{$('tickets-cliente-msg').textContent='Não foi possível atualizar as conversas. Tente novamente.';}
  }
  $('tickets-cliente-atualizar').addEventListener('click',carregarTicketsCliente);
  setInterval(()=>{if(clienteId&&!$('painel-suporte').classList.contains('hidden')&&!document.activeElement?.closest('#lista-tickets'))carregarTicketsCliente();},20000);

  // ===== API KEY =====
  $('btn-gerar-chave')?.addEventListener('click', async()=>{
    $('btn-gerar-chave').disabled=true; $('api-key-msg').textContent='Gerando...';
    try{
      const senha=prompt('Digite sua senha para confirmar:');
      if(!senha){ $('btn-gerar-chave').disabled=false; return; }
      const r=await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'gerar-chave',clienteId,senha})});
      const data=await r.json();
      if(r.ok&&data.chave){  $('api-key-display').textContent=data.chave; $('api-key-msg').textContent='✅ Chave gerada!'; $('api-key-msg').className='msg ok'; }
      else { $('api-key-msg').textContent=data.erro||'Erro'; $('api-key-msg').className='msg erro'; }
    }catch(e){ $('api-key-msg').textContent='Erro de conexão'; $('api-key-msg').className='msg erro'; }
    $('btn-gerar-chave').disabled=false;
  });

  $('btn-revogar-chave')?.addEventListener('click', async()=>{
    if(!confirm('Revogar a chave vai invalidar todas as integrações. Confirma?')) return;
    const senha=prompt('Digite sua senha:'); if(!senha) return;
    const r=await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'revogar-chave',clienteId,senha})});
    if(r.ok){ localStorage.removeItem('eng_apiKey'); $('api-key-display').textContent='Nenhuma chave gerada'; $('api-key-msg').textContent='🗑️ Chave revogada.'; }
  });

  $('btn-copiar-chave')?.addEventListener('click',()=>{
    const chave=$('api-key-display').textContent;
    if(chave&&chave!=='Nenhuma chave gerada'){ navigator.clipboard.writeText(chave); $('api-key-msg').textContent='📋 Copiado!'; $('api-key-msg').className='msg ok'; setTimeout(()=>$('api-key-msg').textContent='',2000); }
  });

  const chaveSalva=null;
  if(chaveSalva&&$('api-key-display')) $('api-key-display').textContent=chaveSalva;

  // ===== SUPORTE WHATSAPP =====
  async function carregarSuporte(){
    try{
      const r=await fetch(`${API_BASE}/api/config`);
      const data=await r.json();
      ordemServicos='prioridade';$('servico-ordem').value='prioridade';
      if(data.whatsappSuporte){ const el=$('float-whats'); if(el){ el.href=`https://wa.me/${data.whatsappSuporte}`; el.style.display='flex'; } }
    }catch(e){}
  }



  // ===== MINHA CONTA =====
  let contaCarregada=false;
  function limparDadosConta(){
    contaCarregada=false;
    $('conta-perfil-form').reset();$('conta-senha-form').reset();
    $('conta-usuario').value='';$('conta-whatsapp').value='';
    for(const id of ['conta-tipo','conta-desconto','conta-criada','conta-senha-data','conta-api-status'])$(id).textContent='—';
    $('conta-msg').textContent='';$('conta-senha-msg').textContent='';
    for(const b of document.querySelectorAll('[data-conta-password]')){const input=$(b.dataset.contaPassword);input.type='password';b.textContent='Mostrar';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Mostrar '+input.labels[0].textContent.toLowerCase());}
  }
  function mostrarDadosConta(c){
    $('conta-nome').value=c.nome||'';$('conta-usuario').value=c.usuario||'';$('conta-usuario').placeholder=c.usuario?'':'Use seu WhatsApp para entrar';$('conta-copiar-login').disabled=!c.usuario;$('conta-whatsapp').value=c.whatsapp||'';
    $('conta-tipo').textContent=c.role==='revendedor'?'Revendedor':'Cliente';
    $('conta-desconto').textContent=Number(c.desconto||0).toLocaleString('pt-BR')+'%';
    $('conta-criada').textContent=c.criadoEm?new Date(c.criadoEm).toLocaleDateString('pt-BR'):'Não informado';
    $('conta-senha-data').textContent=c.senhaAlteradaEm?new Date(c.senhaAlteradaEm).toLocaleString('pt-BR'):'Sem alteração registrada';
    $('conta-api-status').textContent=c.apiAtiva?'Chave ativa':'Nenhuma chave ativa';
    contaCarregada=true;
  }
  async function carregarMinhaConta(){
    const requestedClient=clienteId;if(!requestedClient)return;
    $('conta-msg').textContent='Carregando seus dados...';$('conta-salvar').disabled=true;
    try{const d=await manualRequest('/api/auth-cliente?acao=minha-conta');if(clienteId!==requestedClient)return;mostrarDadosConta(d);$('conta-msg').textContent='';}
    catch(e){if(clienteId===requestedClient)$('conta-msg').textContent=e.message;}
    finally{$('conta-salvar').disabled=!contaCarregada;}
  }
  $('tab-conta').addEventListener('click',()=>{ativarAba('conta');carregarMinhaConta();});
  $('conta-perfil-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!contaCarregada)return;const b=$('conta-salvar');b.disabled=true;
    try{const d=await manualRequest('/api/auth-cliente',{acao:'atualizar-perfil',nome:$('conta-nome').value});mostrarDadosConta(d.conta);clienteNome=d.conta.nome;$('saudacao').textContent='Olá, '+clienteNome;localStorage.setItem('eng_clienteNome',clienteNome);$('conta-msg').textContent='Seu nome foi atualizado.';}
    catch(e){$('conta-msg').textContent=e.message;}finally{b.disabled=false;}
  });
  $('conta-copiar-login').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('conta-usuario').value);$('conta-msg').textContent='Usuário copiado.';}catch{$('conta-msg').textContent='Selecione e copie seu usuário no campo acima.';}});
  $('conta-abrir-api').addEventListener('click',()=>ativarAba('api'));
  for(const b of document.querySelectorAll('[data-conta-password]'))b.addEventListener('click',()=>{const input=$(b.dataset.contaPassword),show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'Ocultar':'Mostrar';b.setAttribute('aria-pressed',String(show));b.setAttribute('aria-label',(show?'Ocultar ':'Mostrar ')+input.labels[0].textContent.toLowerCase());});
  $('conta-senha-form').addEventListener('submit',async e=>{
    e.preventDefault();const current=$('conta-senha-atual').value,password=$('conta-nova-senha').value,confirmation=$('conta-confirmacao').value;
    if(password!==confirmation){$('conta-senha-msg').textContent='A confirmação deve ser igual à nova senha.';return;}
    if(password===current){$('conta-senha-msg').textContent='Escolha uma senha diferente da atual.';return;}
    const button=$('conta-alterar-senha');button.disabled=true;$('conta-senha-msg').textContent='Atualizando sua senha...';
    try{const login=$('conta-usuario').value;await manualRequest('/api/auth-cliente',{acao:'alterar-senha',senhaAtual:current,novaSenha:password,confirmacaoSenha:confirmation});encerrarSessaoLocal();$('bloco-login').classList.remove('hidden');$('bloco-cadastro').classList.add('hidden');$('auth-login-id').value=login;$('auth-senha').value='';msgAuth('Senha alterada com sucesso. Entre novamente com sua nova senha.','ok');$('auth-senha').focus();}
    catch(e){$('conta-senha-msg').textContent=e.message;}
    finally{button.disabled=false;}
  });

  // ===== PIX MANUAL DA REVENDA =====
  let pixManualAtivo=false,pixManualMinimo=5,pixManualCarregando=null,pixManualSelecionado=null;
  const brl=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const manualStatus=status=>({pendente:'Aguardando conferência',aprovado:'Saldo liberado',rejeitado:'Não aprovado'}[status]||status);
  const manualText=(parent,tag,value)=>{const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;};
  async function manualRequest(url,body){
    const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    const data=await r.json();if(!r.ok)throw Error(data.erro||'Não foi possível concluir.');return data;
  }
  function mostrarPixManual(p){
    pixManualSelecionado=p.id;
    const box=$('manual-dados');box.replaceChildren();box.classList.remove('hidden');
    manualText(box,'h3',p.referencia+' · '+brl(p.valor));
    manualText(box,'p',manualStatus(p.status));
    if(p.status!=='pendente'){if(p.observacao)manualText(box,'p',p.observacao);return;}
    const pix=p.pix;if(!pix)return;
    manualText(box,'p','1. No aplicativo do seu banco, faça um PIX de '+brl(p.valor)+' para a chave abaixo.');
    const label=manualText(box,'label','Chave PIX');label.htmlFor='manual-chave-copia';
    const input=document.createElement('input');input.id='manual-chave-copia';input.className='input';input.value=pix.chave;input.readOnly=true;box.append(input);
    const copy=manualText(box,'button','Copiar chave PIX');copy.className='btn-sec';copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pix.chave);copy.textContent='Chave copiada';}catch{$('manual-msg').textContent='Selecione a chave acima e copie.';}});
    manualText(box,'p','Recebedor: '+pix.nomeRecebedor+'. Confira esse nome antes de pagar.');
    if(pix.instrucoes)manualText(box,'p',pix.instrucoes);
    manualText(box,'p','2. Envie o comprovante ao vendedor e informe a referência '+p.referencia+'.');
    const a=manualText(box,'a','Enviar comprovante pelo WhatsApp');a.className='btn';a.target='_blank';a.rel='noopener noreferrer';
    a.href='https://wa.me/'+pix.whatsapp+'?text='+encodeURIComponent('Olá! Quero enviar o comprovante da recarga '+p.referencia+' de '+brl(p.valor)+'.');
    manualText(box,'p','3. Aguarde a conferência. Depois de liberado, o saldo poderá ser usado para fazer seus pedidos.');
  }
  async function carregarPixManualCliente(){
    if(!clienteId)return;
    if(pixManualCarregando)return pixManualCarregando;
    const requestedClient=clienteId;
    pixManualCarregando=(async()=>{
      try{
        const data=await manualRequest('/api/carteira?action=pix-manual');if(clienteId!==requestedClient)return;
        pixManualAtivo=data.disponivel===true;pixManualMinimo=Number(data.configuracao?.minimo||5);
        $('recarga-automatica').classList.toggle('hidden',pixManualAtivo);
        const recargas=data.recargas||[],pending=recargas.some(p=>p.status==='pendente');
        $('pix-manual-cliente').classList.toggle('hidden',!pixManualAtivo&&!pending);
        $('manual-solicitar').disabled=!pixManualAtivo;$('manual-valor').min=pixManualMinimo;$('manual-valor').placeholder='Mínimo '+brl(pixManualMinimo);
        $('eng-pagar-pix').textContent=pixManualAtivo?'Recarregar por PIX manual':'📱 Pagar com PIX';
        $('manual-historico-wrap').classList.toggle('hidden',!pixManualAtivo&&!recargas.length);
        const list=$('manual-historico');list.replaceChildren();
        for(const p of recargas){const div=document.createElement('div');div.className='manual-item';manualText(div,'strong',p.referencia+' · '+brl(p.valor));manualText(div,'p',manualStatus(p.status)+' · '+new Date(p.criadoEm).toLocaleString('pt-BR'));if(p.observacao)manualText(div,'p',p.observacao);
          if(p.status==='pendente'){const b=manualText(div,'button','Ver chave PIX e enviar comprovante');b.type='button';b.className='btn-sec';b.addEventListener('click',()=>mostrarPixManual(p));}list.append(div);}
        if(!list.children.length)manualText(list,'p','Você ainda não solicitou uma recarga manual.');
        if(pixManualSelecionado){const selected=recargas.find(p=>p.id===pixManualSelecionado);if(selected)mostrarPixManual(selected);}
      }catch(e){if(clienteId===requestedClient)$('manual-msg').textContent=e.message;}
    })();
    try{await pixManualCarregando;}finally{pixManualCarregando=null;}
  }
  $('manual-solicitar').addEventListener('click',async()=>{
    const b=$('manual-solicitar');b.disabled=true;$('manual-msg').textContent='Preparando os dados do PIX...';
    try{const d=await manualRequest('/api/carteira',{action:'solicitar-pix-manual',valor:Number($('manual-valor').value)});mostrarPixManual(d.recarga);$('manual-valor').value='';$('manual-solicitar').textContent='Solicitar outra recarga';$('manual-msg').textContent='Solicitação registrada. Pague e envie o comprovante ao vendedor.';await carregarPixManualCliente();}
    catch(e){$('manual-msg').textContent=e.message;}finally{b.disabled=!pixManualAtivo;}
  });
  $('manual-atualizar').addEventListener('click',()=>carregarSaldo());

  let pixRevCarregado=false;
  async function carregarPixRevendedor(reloadConfig=true){
    const data=await manualRequest('/api/revendedor?action=pix-manual');
    if(reloadConfig||!pixRevCarregado){const c=data.configuracao||{};$('rev-pix-ativo').checked=!!c.ativo;$('rev-pix-tipo').value=c.tipoChave||'aleatoria';for(const [id,field]of [['chave','chave'],['recebedor','nomeRecebedor'],['whatsapp','whatsapp'],['minimo','minimo'],['instrucoes','instrucoes']])$('rev-pix-'+id).value=c[field]??(field==='minimo'?5:'');pixRevCarregado=true;}
    const clients=await manualRequest('/api/revendedor?action=clientes'),select=$('rev-pix-cliente'),selected=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Escolha o cliente';select.append(empty);
    for(const c of clients.clientes||[]){const o=document.createElement('option');o.value=c.clienteId;o.textContent=(c.role==='revendedor'?'Sub-revenda: ':'')+c.nome+' · '+c.whatsapp;select.append(o);}select.value=selected;
    const list=$('rev-pix-recargas');list.replaceChildren();
    for(const p of data.recargas||[]){
      const div=document.createElement('div');div.className='manual-item';manualText(div,'h4',p.nomeCliente+' · '+brl(p.valor));
      manualText(div,'p',p.referencia+' · '+new Date(p.criadoEm).toLocaleString('pt-BR')+' · '+manualStatus(p.status));
      if(p.observacao)manualText(div,'p',p.observacao);
      if(p.status==='pendente'){
        const label=document.createElement('label');label.className='manual-check';const check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode('Conferi este PIX no meu banco'));div.append(label);
        const observation=document.createElement('input');observation.className='input';observation.maxLength=300;observation.placeholder='Referência bancária ou motivo da rejeição';observation.setAttribute('aria-label','Observação da recarga '+p.referencia);div.append(observation);
        const actions=document.createElement('div');actions.className='manual-actions';const approve=manualText(actions,'button','Liberar '+brl(p.valor)),reject=manualText(actions,'button','Não aprovar');approve.className='btn';reject.className='btn-sec';approve.type=reject.type='button';approve.disabled=true;check.addEventListener('change',()=>approve.disabled=!check.checked);div.append(actions);
        const decide=async action=>{approve.disabled=reject.disabled=true;$('rev-pix-msg').textContent='Processando...';try{const result=await manualRequest('/api/revendedor',{acao:action+'-pix-manual',recargaId:p.id,confirmado:check.checked,observacao:observation.value});$('rev-pix-msg').textContent=action==='aprovar'?'Saldo liberado uma vez para o cliente.':'Recarga não aprovada.';$('rev-saldo').textContent=brl(result.novoSaldo);await carregarSaldo();await carregarPixRevendedor(false);}catch(e){$('rev-pix-msg').textContent=e.message;approve.disabled=!check.checked;reject.disabled=false;}};
        approve.addEventListener('click',()=>decide('aprovar'));reject.addEventListener('click',()=>decide('rejeitar'));
      }
      list.append(div);
    }
    if(!list.children.length)manualText(list,'p','Nenhuma recarga manual. As solicitações dos seus clientes aparecerão aqui.');
  }
  $('rev-pix-config').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;
    try{await manualRequest('/api/revendedor',{acao:'configurar-pix-manual',ativo:$('rev-pix-ativo').checked,tipoChave:$('rev-pix-tipo').value,chave:$('rev-pix-chave').value,nomeRecebedor:$('rev-pix-recebedor').value,whatsapp:$('rev-pix-whatsapp').value,minimo:Number($('rev-pix-minimo').value),instrucoes:$('rev-pix-instrucoes').value});$('rev-pix-config-msg').textContent='Configuração salva. Seus clientes já podem consultar esta opção em Meu saldo.';}
    catch(e){$('rev-pix-config-msg').textContent=e.message;}finally{button.disabled=false;}
  });
  $('rev-pix-atualizar').addEventListener('click',()=>carregarPixRevendedor(false).catch(e=>$('rev-pix-msg').textContent=e.message));
  $('rev-pix-credito').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;$('rev-pix-credito-msg').textContent='Transferindo saldo...';
    try{const result=await manualRequest('/api/revendedor',{acao:'creditar-cliente-manual',clienteId:$('rev-pix-cliente').value,valor:Number($('rev-pix-valor').value),observacao:$('rev-pix-observacao').value,confirmado:$('rev-pix-confirmado').checked});$('rev-pix-credito-msg').textContent='Saldo transferido para o cliente. Seu saldo: '+brl(result.novoSaldo);$('rev-pix-valor').value='';$('rev-pix-confirmado').checked=false;$('rev-pix-observacao').value='';await carregarSaldo();await carregarPixRevendedor(false);$('rev-saldo').textContent=brl(result.novoSaldo);}
    catch(e){$('rev-pix-credito-msg').textContent=e.message;}finally{button.disabled=false;}
  });


  // ===== SUB-REVENDAS POR CONVITE =====
  let conviteSubrevenda=new URLSearchParams(location.search).get('convite')||'',conviteSubValido=false;
  async function carregarConviteSubrevenda(){
    if(!conviteSubrevenda)return;
    $('sub-convite-msg').classList.remove('hidden');$('sub-convite-msg').textContent='Conferindo seu convite de sub-revenda...';
    try{const d=await manualRequest('/api/auth-cliente?acao=convite-subrevenda&convite='+encodeURIComponent(conviteSubrevenda));conviteSubValido=true;$('sub-convite-msg').textContent='Você foi convidado por '+d.nomeRevenda+'. Crie sua conta para abrir sua sub-revenda.';$('bloco-login').classList.add('hidden');$('bloco-cadastro').classList.remove('hidden');$('btn-cadastrar').textContent='Criar minha sub-revenda';}
    catch(e){$('sub-convite-msg').textContent=e.message;msgAuth('Peça um novo convite ao seu revendedor.','erro');}
  }
  async function carregarSubrevendas(){
    const d=await manualRequest('/api/revendedor?action=subrevendas'),list=$('rev-sub-lista');list.replaceChildren();
    for(const c of d.subrevendedores||[]){const div=document.createElement('div');div.className='manual-item';manualText(div,'h4',c.nome);manualText(div,'p','Usuário: '+c.usuario+' · Saldo: '+brl(c.saldo));const b=manualText(div,'button','Adicionar saldo recebido');b.type='button';b.className='btn-sec';b.addEventListener('click',async()=>{try{$('tab-rev-pix').click();await carregarPixRevendedor();$('rev-pix-cliente').value=c.clienteId;$('rev-pix-valor').focus();$('rev-pix-credito-msg').textContent='Confira o pagamento recebido desta sub-revenda antes de liberar o saldo.';}catch(e){$('rev-sub-msg').textContent=e.message;}});list.append(div);}
    if(!list.children.length)manualText(list,'p','Você ainda não tem sub-revendas. Gere um convite para começar.');
    const invites=$('rev-sub-convites');invites.replaceChildren();
    for(const invite of d.convites||[]){const div=document.createElement('div');div.className='manual-item';manualText(div,'p',({ativo:'Aguardando cadastro',utilizado:'Cadastro concluído',revogado:'Convite cancelado',expirado:'Convite expirado'}[invite.status]||invite.status)+' · Criado em '+new Date(invite.criadoEm).toLocaleString('pt-BR'));if(invite.status==='ativo'){const b=manualText(div,'button','Cancelar convite');b.type='button';b.className='btn-sec';b.addEventListener('click',async()=>{b.disabled=true;try{await manualRequest('/api/revendedor',{acao:'revogar-convite-subrevenda',conviteId:invite.id});await carregarSubrevendas();}catch(e){$('rev-sub-msg').textContent=e.message;b.disabled=false;}});}invites.append(div);}
    if(!invites.children.length)manualText(invites,'p','Nenhum convite gerado.');
  }
  $('rev-sub-convite').addEventListener('click',async()=>{
    const b=$('rev-sub-convite');b.disabled=true;
    try{const d=await manualRequest('/api/revendedor',{acao:'criar-convite-subrevenda'});$('rev-sub-link').value=d.url;$('rev-sub-link-wrap').classList.remove('hidden');$('rev-sub-expiracao').textContent='Válido até '+new Date(d.expiraEm).toLocaleString('pt-BR')+'. Uso único.';$('rev-sub-msg').textContent='Convite pronto. A pessoa escolherá o próprio usuário e senha.';await carregarSubrevendas();}
    catch(e){$('rev-sub-msg').textContent=e.message;}finally{b.disabled=false;}
  });
  $('rev-sub-copiar').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('rev-sub-link').value);$('rev-sub-msg').textContent='Convite copiado. Envie para a pessoa que abrirá a sub-revenda.';}catch{$('rev-sub-msg').textContent='Selecione o link acima e copie.';}});
  $('rev-sub-atualizar').addEventListener('click',()=>carregarSubrevendas().catch(e=>$('rev-sub-msg').textContent=e.message));

  // ===== REVENDEDOR =====
  async function carregarPainelRevendedor(){
    try{
      const r=await fetch('/api/revendedor');
      const data=await r.json();
      if($('rev-saudacao')) $('rev-saudacao').textContent=`Olá, ${data.nome}!`;
      if($('rev-saldo')) $('rev-saldo').textContent=`R$ ${Number(data.saldo||0).toFixed(2)}`;
      if($('rev-desconto')) $('rev-desconto').textContent=`${data.desconto||0}%`;
    }catch(e){}
    carregarClientesRevendedor();
  }

  async function carregarClientesRevendedor(){
    try{
      const rr=await fetch('/api/revendedor?action=clientes');const dados=await rr.json();
      const lista=$('lista-rev-clientes');if(!lista)return;lista.replaceChildren();
      for(const c of dados.clientes||[]){const div=document.createElement('div');div.textContent=(c.role==='revendedor'?'Sub-revenda: ':'')+c.nome+' · '+c.whatsapp;lista.append(div);}
      $('rev-total-clientes').textContent=(dados.clientes||[]).length;
      if(!lista.children.length)lista.textContent='Nenhum cliente ainda.';
    }catch(e){}
  }

  async function carregarPedidosRevendedor(){
    try{
      const r=await fetch(`${API_BASE}/api/pedidos?revendedorId=${encodeURIComponent(clienteId)}`);
      const data=await r.json();
      const tbody=$('tabela-rev-pedidos'); if(!tbody) return;
      tbody.innerHTML=safeHTML('');
      (data.pedidos||[]).forEach(p=>{
        const tr=document.createElement('tr'); tr.style.borderBottom='1px solid var(--line)';
        tr.innerHTML = safeRowHTML(`<td style="padding:8px 6px;color:var(--accent);font-weight:700;">${escapeHTML(p.numeroPedido||'-')}</td><td style="padding:8px 6px;font-size:12px;">${escapeHTML(p.clienteId||'-')}</td><td style="padding:8px 6px;font-size:12px;">${escapeHTML(p.nomeServico||'-')}</td><td style="padding:8px 6px;">${escapeHTML(p.quantidade)}</td><td style="padding:8px 6px;">R$ ${escapeHTML(Number(p.valorTotal).toFixed(2))}</td><td style="padding:8px 6px;"><span class="status-pill ${escapeHTML(p.status)}">${escapeHTML(formatarStatus(p.status))}</span></td>`);
        tbody.appendChild(tr);
      });
      if(!data.pedidos?.length) $('rev-pedidos-msg').textContent='Nenhum pedido ainda.';
    }catch(e){}
  }

  ['clientes','pedidos','novo','pix','subrevendas'].forEach(aba=>{
    const tab=$(`tab-rev-${aba}`); if(!tab) return;
    tab.addEventListener('click',()=>{
      ['clientes','pedidos','novo','pix','subrevendas'].forEach(a=>{ $(`tab-rev-${a}`)?.classList.remove('ativa'); $(`painel-rev-${a}`)?.classList.add('hidden'); });
      tab.classList.add('ativa'); $(`painel-rev-${aba}`)?.classList.remove('hidden');
      if(aba==='pedidos') carregarPedidosRevendedor();
      if(aba==='subrevendas')carregarSubrevendas().catch(e=>$('rev-sub-msg').textContent=e.message);
      if(aba==='pix')carregarPixRevendedor().catch(e=>$('rev-pix-msg').textContent=e.message);
    });
  });

  $('rev-nc-btn')?.addEventListener('click', async()=>{
    const nome=$('rev-nc-nome').value, whats=$('rev-nc-whats').value, usuario=$('rev-nc-usuario').value, senha=$('rev-nc-senha').value;
    if(!nome||!whats||!senha){ $('rev-nc-msg').textContent='Preencha todos os campos'; $('rev-nc-msg').className='msg erro'; return; }
    $('rev-nc-btn').disabled=true;
    try{
      const r=await fetch(`${API_BASE}/api/revendedor`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revendedorId:clienteId,acao:'criar-cliente',nomeCliente:nome,whatsappCliente:whats,usuarioCliente:usuario,senhaCliente:senha})});
      const data=await r.json();
      if(r.ok){ $('rev-nc-msg').textContent=`✅ Cliente cadastrado! ID: ${data.clienteId}`; $('rev-nc-msg').className='msg ok'; $('rev-nc-nome').value=''; $('rev-nc-whats').value=''; $('rev-nc-usuario').value=''; $('rev-nc-senha').value=''; }
      else { $('rev-nc-msg').textContent=data.erro||'Erro'; $('rev-nc-msg').className='msg erro'; }
    }catch(e){ $('rev-nc-msg').textContent='Erro de conexão'; $('rev-nc-msg').className='msg erro'; }
    $('rev-nc-btn').disabled=false;
  });

  $('rev-sair-btn')?.addEventListener('click',()=>$('btn-login-logout').click());

  // ===== ÍCONES FLUTUANTES =====
  function gerarIconesFlutuantes(){
    const container=$('floating-icons'); if(!container) return;
    const icones=['📸','❤️','👥','💬','▶️','⭐','🔥','📊','🚀','✨','🎯','📱','🎵','𝕏','📘'];
    for(let i=0;i<30;i++){
      const el=document.createElement('div'); el.className='fi';
      el.textContent=icones[Math.floor(Math.random()*icones.length)];
      el.style.left=Math.random()*100+'vw'; el.style.animationDuration=(12+Math.random()*20)+'s';
      el.style.animationDelay=(Math.random()*20)+'s'; el.style.fontSize=(20+Math.random()*28)+'px';
      container.appendChild(el);
    }
  }

  function gerarIconesFlutuantesLogado(){
    const container=$('floating-icons-logado'); if(!container||container.children.length>0) return;
    const icones=['📸','❤️','👥','💬','▶️','⭐','🔥','📊','🚀','✨','🎯','📱','🎵','📈'];
    for(let i=0;i<15;i++){
      const el=document.createElement('div'); el.className='fi';
      el.textContent=icones[Math.floor(Math.random()*icones.length)];
      el.style.left=Math.random()*100+'vw'; el.style.animationDuration=(15+Math.random()*25)+'s';
      el.style.animationDelay=(Math.random()*25)+'s'; el.style.fontSize=(14+Math.random()*18)+'px';
      container.appendChild(el);
    }
  }

  // ===== PWA =====
  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; const btn=$('btn-instalar-app'); if(btn) btn.style.display='flex'; });
  window.addEventListener('appinstalled',()=>{ const btn=$('btn-instalar-app'); if(btn) btn.style.display='none'; deferredPrompt=null; });
  document.getElementById('btn-instalar-app')?.addEventListener('click',async()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt=null; });
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  // ===== VALOR MÍNIMO RECARGA =====
  async function carregarMinRecarga(){
    try{
      const r=await fetch(`${API_BASE}/api/config`);
      const data=await r.json();
      const min=Number(data.minRecarga||5);
      const inp=$('deposito-valor');
      if(inp){ inp.min=min; inp.placeholder=`Mínimo R$ ${min.toFixed(2)}`; }
    }catch(e){}
  }

  async function restaurarSessao(){
    try{const r=await fetch('/api/auth-cliente');if(r.ok){const d=await r.json();clienteId=d.clienteId;clienteNome=d.nome||'';isRevendedor=d.role==='revendedor';atualizarTopBar();await carregarFiltrosIniciais();}}catch{}
  }
  carregarConviteSubrevenda();
  restaurarSessao();
  // ===== INIT =====
  atualizarTopBar();
  carregarFiltrosIniciais();
  carregarSuporte();
  gerarIconesFlutuantes();
  iniciarAtualizacaoPedidos();
  carregarMinRecarga();
})();
