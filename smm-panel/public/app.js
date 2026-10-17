(function(){
  const API_BASE = '';
  const fetch = window.smmFetch;
  const $ = (id) => document.getElementById(id);
  let clienteId = null;
  let clienteNome = '';
  let isRevendedor = false;
  localStorage.removeItem('eng_revSenha'); localStorage.removeItem('eng_apiKey');
  let whatsappSuporte = '';
  let ordemServicos = 'padrao';

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
      ['pedidos','carteira','suporte','api','vitrine','revendedor'].forEach(p => $(`painel-${p}`)?.classList.add('hidden'));
    }
  }

  $('btn-login-logout').addEventListener('click', async () => {
    await fetch('/api/auth-cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'logout'})});
    localStorage.removeItem('eng_clienteId'); localStorage.removeItem('eng_clienteNome');
    clienteId = null; clienteNome = ''; isRevendedor = false;
    $('api-key-display').textContent='Nenhuma chave gerada';
    $('api-key-msg').textContent='';
    for(const k of Object.keys(sessionStorage))if(k.startsWith('smm_pending:'))sessionStorage.removeItem(k);
    atualizarTopBar();
  });

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
    if(!nome){ msgAuth('Informe seu nome','erro'); return; }
    if(!usuario||usuario.length<3){ msgAuth('Usuário deve ter pelo menos 3 caracteres','erro'); return; }
    if(!whatsapp){ msgAuth('Informe seu WhatsApp','erro'); return; }
    if(!senha||senha.length<8){ msgAuth('Senha deve ter pelo menos 8 caracteres','erro'); return; }
    try{
      const r = await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'cadastro',nome,usuario,whatsapp,senha,origem})});
      const data = await r.json();
      if(!r.ok){ msgAuth(data.erro||'Erro ao criar conta','erro'); return; }
      clienteId=data.clienteId; clienteNome=data.nome||'';
      localStorage.setItem('eng_clienteId',clienteId); localStorage.setItem('eng_clienteNome',clienteNome);
      atualizarTopBar();
    }catch(e){ msgAuth('Erro de conexão','erro'); }
  });

  function msgAuth(texto,tipo){ $('auth-msg').textContent=texto; $('auth-msg').className='auth-msg'+(tipo?' '+tipo:''); }

  // ===== ABAS =====
  function ativarAba(aba){
    ['engajar','pedidos','carteira','suporte','api','vitrine','revendedor'].forEach(a=>{
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

  const iconeRede = {instagram:'📸',tiktok:'🎵',youtube:'▶️',facebook:'📘',twitter:'𝕏',spotify:'🎵',telegram:'✈️'};

  function capitalizar(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }
  const moeda = valor => Number(valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const tarifa = valor => Number(valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:8});
  function etapaCompra(etapa){
    for(const id of ['rede','tipo','servico','pagar']){
      const el=$('passo-'+id);if(id===etapa)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
    }
  }
  function quantidadeInicial(s){
    return Math.max(Number(s.min),Math.ceil(5/Number(s.precoPorMil)));
  }
  function nomeAmigavel(nome){
    const termos=[[/\bNo\s*Refill\b/gi,'Sem reposição'],[/\bNon[- ]?Drop\b/gi,'Baixa queda'],[/\bHigh Quality\b|\bHQ\b/gi,'Alta qualidade'],[/\bFollowers\b/gi,'Seguidores'],[/\bLikes\b/gi,'Curtidas'],[/\bViews\b/gi,'Visualizações'],[/\bSubscribers\b/gi,'Inscritos'],[/\bComments\b/gi,'Comentários'],[/\bShares\b/gi,'Compartilhamentos'],[/\bRefill\b/gi,'Reposição'],[/\bInstant\b/gi,'Início imediato'],[/\bBrazilian\b/gi,'Brasileiros'],[/\bWorldwide\b/gi,'Mundial']];
    return termos.reduce((text,[pattern,value])=>text.replace(pattern,value),String(nome||''));
  }

  function ordenarServicos(lista){
    if(ordemServicos==='preco_asc') return [...lista].sort((a,b)=>a.precoPorMil-b.precoPorMil);
    if(ordemServicos==='preco_desc') return [...lista].sort((a,b)=>b.precoPorMil-a.precoPorMil);
    if(ordemServicos==='destaque') return [...lista].sort((a,b)=>(b.destaque?1:0)-(a.destaque?1:0));
    return lista;
  }

  async function carregarFiltrosIniciais(){
    try{
      const r = await fetch(`${API_BASE}/api/services`);
      if(!r.ok)throw new Error();
      const data = await r.json();
      const redesTabs = $('redes-tabs');
      redesTabs.innerHTML = safeHTML('');
      (data.redesSociais||[]).forEach(rede=>{
        const btn = document.createElement('button');
        btn.className = 'rede-tab';
        btn.textContent = (iconeRede[rede.toLowerCase()]||'🌐') + ' ' + capitalizar(rede);
        btn.dataset.rede = rede;
        btn.addEventListener('click',()=>selecionarRede(rede));
        redesTabs.appendChild(btn);
      });
      if(!redesTabs.children.length)redesTabs.textContent='Nenhuma opção disponível agora. Fale com a equipe na aba Preciso de ajuda.';
    }catch(e){ $('redes-tabs').innerHTML=safeHTML('<p style="color:var(--muted);font-size:13px;">Erro ao carregar redes.</p>'); }
  }

  async function selecionarRede(rede){
    etapaCompra('tipo');
    redeSelecionada = rede; tipoSelecionado = ''; servicoSelecionado = null;
    // destaca o botão
    document.querySelectorAll('.rede-tab').forEach(b=>b.classList.toggle('ativa',b.dataset.rede===rede));
    // mostra spinner
    $('painel-tipos').classList.remove('hidden');
    $('painel-servicos-lista').classList.add('hidden');
    $('painel-form-pedido').classList.add('hidden');
    $('rede-selecionada-label').textContent = (iconeRede[rede.toLowerCase()]||'🌐') + ' ' + capitalizar(rede);
    $('tipos-chips').innerHTML = safeHTML('<span style="color:var(--muted);font-size:13px;">Carregando...</span>');

    try{
      const r = await fetch(`${API_BASE}/api/services?redeSocial=${encodeURIComponent(rede)}`);
      if(!r.ok)throw new Error();
      const data = await r.json();
      if(redeSelecionada!==rede)return;
      todosServicos = data.servicos||[];
      const tipos = [...new Set(todosServicos.map(s=>s.servicoTipo).filter(Boolean))];
      $('tipos-chips').innerHTML = safeHTML('');
      tipos.forEach(tipo=>{
        const chip = document.createElement('button');
        chip.className = 'tipo-chip';
        chip.textContent = capitalizar(tipo);
        chip.dataset.tipo = tipo;
        chip.addEventListener('click',()=>selecionarTipo(tipo));
        $('tipos-chips').appendChild(chip);
      });
      if(!tipos.length)$('tipos-chips').textContent='Não há opções disponíveis nesta rede no momento. Escolha outra rede.';
    }catch(e){ $('tipos-chips').innerHTML=safeHTML('<span style="color:#ff8b8b;font-size:13px;">Erro ao carregar tipos.</span>'); }
  }

  function selecionarTipo(tipo){
    etapaCompra('servico');
    tipoSelecionado = tipo; servicoSelecionado = null;
    document.querySelectorAll('.tipo-chip').forEach(c=>c.classList.toggle('ativo',c.dataset.tipo===tipo));
    $('tipo-selecionado-label').textContent = capitalizar(tipo);
    const filtrados = ordenarServicos(todosServicos.filter(s=>(s.servicoTipo||'').toLowerCase()===tipo.toLowerCase()));
    const lista = $('servicos-lista');
    lista.innerHTML = safeHTML('');
    filtrados.forEach(s=>{
      const card = document.createElement('button');
      card.type='button';card.setAttribute('aria-pressed','false');
      card.className = 'servico-card';
      card.dataset.id = s.id;
      card.innerHTML = safeHTML(`
        <div class="servico-card-top">
          <span class="servico-card-nome">${escapeHTML(s.icone?s.icone+' ':'')}${escapeHTML(nomeAmigavel(s.nome))}</span>
          <span class="servico-card-preco">${escapeHTML(moeda(Math.round(s.precoPorMil*quantidadeInicial(s)/10)/100))}<br><span class="preco-detalhe">por ${escapeHTML(quantidadeInicial(s).toLocaleString('pt-BR'))}</span></span>
        </div>
        <div class="servico-card-info">De ${escapeHTML(s.min)} até ${escapeHTML(s.max.toLocaleString('pt-BR'))} · ${escapeHTML(tarifa(s.precoPorMil))} por 1.000${escapeHTML(s.refill?' · Reposição disponível':'')}</div>
      `);
      card.addEventListener('click',()=>selecionarServico(s));
      lista.appendChild(card);
    });
    $('painel-servicos-lista').classList.remove('hidden');
    $('painel-form-pedido').classList.add('hidden');
  }

  function selecionarServico(s){
    etapaCompra('pagar');
    servicoSelecionado = s;
    document.querySelectorAll('.servico-card').forEach(c=>c.classList.toggle('selecionado',String(c.dataset.id)===String(s.id)));
    document.querySelectorAll('.servico-card').forEach(c=>c.setAttribute('aria-pressed',String(String(c.dataset.id)===String(s.id))));
    $('servico-nome-display').textContent = (s.icone?s.icone+' ':'')+nomeAmigavel(s.nome);
    $('servico-info-display').textContent = `${tarifa(s.precoPorMil)} por 1.000 · Quantidade de ${s.min} a ${s.max.toLocaleString('pt-BR')}`;
    // instrução
    const instrEl = $('eng-instrucao');
    const tipo = (s.servicoTipo||'').toLowerCase();
    const nome = (s.nome||'').toLowerCase();
    let instrucao='', placeholder='https://...';
    if(tipo.includes('seguidor')||nome.includes('seguidor')){
      instrucao=`👤 <strong>Cole o link do seu perfil.</strong><br>Mantenha o perfil público durante o processamento. Não precisamos da senha da sua rede social.`;
      placeholder='https://instagram.com/seuperfil';
    } else if(tipo.includes('curtida')||nome.includes('curtida')||nome.includes('like')){
      instrucao=`❤️ <strong>Cole o link da postagem</strong> que deseja receber curtidas.<br>⚠️ Postagem deve estar <strong>pública</strong>.`;
      placeholder='https://instagram.com/p/seu-post';
    } else if(tipo.includes('visuali')||nome.includes('view')){
      instrucao=`▶️ <strong>Cole o link do vídeo/reels</strong><br>⚠️ Conteúdo deve estar <strong>público</strong>.`;
      placeholder='https://instagram.com/reel/seu-video';
    } else if(tipo.includes('comentar')||nome.includes('comment')){
      instrucao=`💬 <strong>Cole o link da postagem</strong> onde deseja comentários.<br>⚠️ Postagem deve estar <strong>pública</strong>.`;
      placeholder='https://instagram.com/p/seu-post';
    } else {
      instrucao=`🔗 <strong>Cole o link correto</strong> para o serviço.<br>⚠️ O perfil ou postagem deve estar <strong>público</strong>.`;
    }
    instrEl.innerHTML = safeHTML(instrucao);
    instrEl.style.display = 'block';
    const hosts={instagram:'https://www.instagram.com/',tiktok:'https://www.tiktok.com/@',youtube:'https://www.youtube.com/',facebook:'https://www.facebook.com/',twitter:'https://x.com/',telegram:'https://t.me/',spotify:'https://open.spotify.com/'};
    if(hosts[redeSelecionada])placeholder=hosts[redeSelecionada]+(tipo.includes('seguidor')?'seuperfil':'link-da-publicacao');
    $('eng-link').placeholder = placeholder;
    $('eng-link').value=''; $('eng-qtd').value=quantidadeInicial(s);
    $('eng-qtd').min=s.min;$('eng-qtd').max=s.max;
    $('eng-qtd-ajuda').textContent=`Escolha entre ${s.min.toLocaleString('pt-BR')} e ${s.max.toLocaleString('pt-BR')}. O valor total aparece ao informar um link válido.`;
    $('eng-validacao').textContent='';$('eng-quantidades').replaceChildren();
    [...new Set([quantidadeInicial(s),100,500,1000])].filter(q=>q>=s.min&&q<=s.max).sort((a,b)=>a-b).forEach(q=>{
      const button=document.createElement('button');button.type='button';button.textContent=q.toLocaleString('pt-BR');button.addEventListener('click',()=>{$('eng-qtd').value=q;atualizarPreco();});$('eng-quantidades').append(button);
    });
    $('eng-resultado').classList.add('hidden');
    $('eng-msg').textContent='';
    const isCustom = s.tipo?.toLowerCase().includes('custom')||nome.includes('personaliz')||nome.includes('custom');
    $('eng-comments-wrap').classList.toggle('hidden',!isCustom);
    if(!isCustom) $('eng-comments').value='';
    $('painel-form-pedido').classList.remove('hidden');
    $('painel-form-pedido').scrollIntoView({behavior:'smooth',block:'start'});
  }

  $('btn-voltar-servicos').addEventListener('click',()=>{
    etapaCompra('servico');
    $('painel-form-pedido').classList.add('hidden');
    $('painel-servicos-lista').scrollIntoView({behavior:'smooth',block:'start'});
  });

  function atualizarPreco(){
    $('eng-resultado').classList.add('hidden');$('eng-validacao').textContent='';
    if(!servicoSelecionado)return false;
    const link=$('eng-link').value.trim();
    if(!link)return false;
    try{const url=new URL(link);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();}
    catch{$('eng-validacao').textContent='Cole o link completo, começando com https://';return false;}
    const qtd=Number($('eng-qtd').value);
    if(!Number.isSafeInteger(qtd)||qtd<servicoSelecionado.min||qtd>servicoSelecionado.max){$('eng-validacao').textContent=`Informe uma quantidade inteira entre ${servicoSelecionado.min} e ${servicoSelecionado.max.toLocaleString('pt-BR')}.`;return false;}
    const total=Math.round(servicoSelecionado.precoPorMil*qtd/10)/100;
    if(total<0.01){$('eng-validacao').textContent='Aumente a quantidade para atingir o valor mínimo de R$ 0,01.';return false;}
    if(!$('eng-comments-wrap').classList.contains('hidden')&&!$('eng-comments').value.trim()){$('eng-validacao').textContent='Escreva os comentários que deseja enviar, um por linha.';return false;}
    $('eng-resumo').textContent=`Confira: ${qtd.toLocaleString('pt-BR')} ${servicoSelecionado.servicoTipo||'unidades'} em ${capitalizar(redeSelecionada)} para ${link}`;
    $('eng-preco').textContent=moeda(total);
    $('eng-resultado').classList.remove('hidden');
    return true;
  }

  $('eng-link').addEventListener('input',atualizarPreco);
  $('eng-qtd').addEventListener('input',atualizarPreco);
  $('eng-comments').addEventListener('input',atualizarPreco);

  function msgEng(texto,tipo){ $('eng-msg').textContent=texto||''; $('eng-msg').className='msg'+(tipo?' '+tipo:''); }

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
    }catch(e){}
  }

  $('deposito-btn').addEventListener('click', async()=>{
    const valor=Number($('deposito-valor').value);
    if(!valor||valor<5){ $('deposito-msg').textContent='Valor mínimo é R$ 5,00'; $('deposito-msg').className='msg erro'; return; }
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
    const valorTotal=Math.round(servicoSelecionado.precoPorMil*qtd/10)/100;
    try{ const rS=await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`); const dS=await rS.json(); saldoAtual=Number(dS.saldo||0); $('saldo-display').textContent=`💰 R$ ${saldoAtual.toFixed(2)}`; }catch(e){}
    if(saldoAtual<valorTotal){ msgEng(`Saldo insuficiente (R$ ${saldoAtual.toFixed(2)}). Recarregue na aba Carteira.`,'erro'); return; }
    $('eng-pagar-saldo').disabled=true; msgEng('Processando com saldo...');
    try{
      const r=await fetch(`${API_BASE}/api/order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idFornecedor:servicoSelecionado.id,link:$('eng-link').value,quantidade:qtd,clienteId,pagarComSaldo:true,comments:$('eng-comments').value||null})});
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
    $('eng-pagar-pix').disabled=true; msgEng('Criando pedido...');
    try{
      const r=await fetch(`${API_BASE}/api/order`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idFornecedor:servicoSelecionado.id,link:$('eng-link').value,quantidade:Number($('eng-qtd').value),clienteId,pagarComSaldo:false,comments:$('eng-comments').value||null})});
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
      const emAndamento=(data.pedidos||[]).filter(p=>p.status==='executando'&&p.orderIdFornecedor);
      await Promise.all(emAndamento.map(p=>fetch(`${API_BASE}/api/pedidos?pedidoId=${escapeHTML(encodeURIComponent(p.id))}`).catch(()=>{})));
      const r2=await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data2=await r2.json();
      (data2.pedidos||data.pedidos).forEach(p=>{
        const progresso=p.startCount&&p.quantidade?Math.min(100,Math.round(((p.quantidade-(p.restam||p.quantidade))/p.quantidade)*100)):(p.status==='concluido'?100:p.status==='executando'?50:0);
        const corStatus={aguardando_pagamento:'#8b929b',executando:'#ffc97c',concluido:'#7CFFB2',cancelado:'#ff8b8b',erro_fornecedor:'#ff8b8b'};
        const cor=corStatus[p.status]||'#8b929b';
        const div=document.createElement('div'); div.className='pedido-item';
        div.innerHTML=safeHTML(`
          <div class="pedido-top"><span>${escapeHTML(p.nomeServico||'Serviço')}</span><span class="status-pill ${escapeHTML(p.status)}">${escapeHTML(formatarStatus(p.status))}</span></div>
          <div class="pedido-sub">${p.numeroPedido?`<strong style="color:var(--accent)">${escapeHTML(p.numeroPedido)}</strong> · `:''}Qtd: ${escapeHTML(p.quantidade)} · R$ ${escapeHTML(Number(p.valorTotal).toFixed(2))} · ${escapeHTML(new Date(p.criadoEm).toLocaleDateString('pt-BR'))}${escapeHTML(p.pagamento==='saldo'?' · 💰 Saldo':'')}</div>
          ${p.link?`<div style="font-size:11.5px;margin-top:4px;"><a href="${escapeHTML(p.link)}" target="_blank" style="color:var(--muted);text-decoration:none;">🔗 ${escapeHTML(p.link.length>50?p.link.slice(0,50)+'...':p.link)}</a></div>`:''}
          ${p.status==='executando'||p.status==='concluido'?`<div style="margin-top:8px;"><div style="height:4px;background:var(--line);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${progresso}%;background:${cor};border-radius:4px;transition:width .5s;"></div></div><div style="font-size:11px;color:var(--muted);margin-top:4px;">${progresso}% concluído${p.restam?` · ${escapeHTML(p.restam)} restando`:''}</div></div>`:''}`);
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
  $('ticket-enviar').addEventListener('click', async()=>{
    const mensagem=$('ticket-mensagem').value;
    if(!mensagem) return;
    try{
      const r=await fetch(`${API_BASE}/api/tickets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId,nome:clienteNome,mensagem})});
      if(r.ok){ $('ticket-msg').textContent='Mensagem enviada!'; $('ticket-msg').className='msg ok'; $('ticket-mensagem').value=''; }
      else { $('ticket-msg').textContent='Erro ao enviar.'; $('ticket-msg').className='msg erro'; }
    }catch(e){ $('ticket-msg').textContent='Erro de conexão.'; $('ticket-msg').className='msg erro'; }
  });

  async function carregarTicketsCliente(){
    if(!clienteId) return;
    try{
      const r=await fetch(`${API_BASE}/api/tickets?clienteId=${encodeURIComponent(clienteId)}`);
      const data=await r.json();
      const lista=$('lista-tickets'); lista.innerHTML=safeHTML('');
      if(!data.tickets||data.tickets.length===0){ $('tickets-cliente-msg').textContent='Nenhum ticket ainda.'; return; }
      $('tickets-cliente-msg').textContent='';
      data.tickets.forEach(t=>{
        const div=document.createElement('div'); div.className='pedido-item';
        div.innerHTML=safeHTML(`<div class="pedido-top"><span style="font-size:12.5px;">${escapeHTML(t.mensagem)}</span><span class="status-pill ${escapeHTML(t.status==='resolvido'?'concluido':'executando')}">${escapeHTML(t.status==='resolvido'?'Resolvido':'Aberto')}</span></div>
          <div class="pedido-sub">${escapeHTML(new Date(t.criadoEm).toLocaleDateString('pt-BR'))}</div>
          ${t.resposta?`<div style="margin-top:10px;background:#0e1013;border-left:3px solid var(--accent);padding:10px 12px;border-radius:0 8px 8px 0;"><div style="font-size:11px;color:var(--accent);margin-bottom:4px;">💬 Resposta do suporte</div><div style="font-size:13px;">${escapeHTML(t.resposta)}</div></div>`:'<div style="font-size:11px;color:var(--muted);margin-top:6px;">⏳ Aguardando resposta</div>'}`);
        lista.appendChild(div);
      });
    }catch(e){ $('tickets-cliente-msg').textContent='Erro ao carregar tickets.'; }
  }

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
      ordemServicos=data.ordemServicos||'padrao';
      if(data.whatsappSuporte){ const el=$('float-whats'); if(el){ el.href=`https://wa.me/${data.whatsappSuporte}`; el.style.display='flex'; } }
    }catch(e){}
  }

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
      for(const c of dados.clientes||[]){const div=document.createElement('div');div.textContent=c.nome+' · '+c.whatsapp;lista.append(div);}
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

  ['clientes','pedidos','novo'].forEach(aba=>{
    const tab=$(`tab-rev-${aba}`); if(!tab) return;
    tab.addEventListener('click',()=>{
      ['clientes','pedidos','novo'].forEach(a=>{ $(`tab-rev-${a}`)?.classList.remove('ativa'); $(`painel-rev-${a}`)?.classList.add('hidden'); });
      tab.classList.add('ativa'); $(`painel-rev-${aba}`)?.classList.remove('hidden');
      if(aba==='pedidos') carregarPedidosRevendedor();
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
  restaurarSessao();
  // ===== INIT =====
  atualizarTopBar();
  carregarFiltrosIniciais();
  carregarSuporte();
  gerarIconesFlutuantes();
  iniciarAtualizacaoPedidos();
  carregarMinRecarga();
})();
