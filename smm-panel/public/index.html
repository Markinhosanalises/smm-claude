<!-- public/index.html -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Engajar seu perfil</title>
<style>
  :root{
    --bg:#0b0d10; --card:#15181c; --line:#23272d;
    --text:#eef1f4; --muted:#8b929b; --accent:#7CFFB2; --accent-dim:#1f3a2c;
  }
  *{box-sizing:border-box;}
  body{
    margin:0;background:var(--bg);color:var(--text);
    font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
    padding:0 0 100px;
  }
  .container{width:100%;max-width:460px;margin:0 auto;padding:0 16px;}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;margin-bottom:20px;}
  .eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0 0 6px;font-weight:600;}
  .title{font-size:22px;font-weight:700;margin:0 0 4px;line-height:1.25;}
  .sub{font-size:13.5px;color:var(--muted);margin:0 0 24px;}
  .label{display:block;font-size:12.5px;color:var(--muted);margin-bottom:6px;}
  .input, .select{
    width:100%;background:#0e1013;border:1px solid var(--line);color:var(--text);
    padding:12px 14px;border-radius:10px;font-size:14.5px;outline:none;margin-bottom:14px;
    transition:border-color .15s ease;
  }
  .input:focus, .select:focus{border-color:var(--accent);}
  .input:disabled, .select:disabled{opacity:.4;cursor:not-allowed;}
  .btn{
    width:100%;background:var(--accent);color:#08110c;border:none;padding:14px;
    border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:filter .15s ease;
  }
  .btn:hover{filter:brightness(1.08);}
  .btn:disabled{background:var(--line);color:var(--muted);cursor:not-allowed;}
  .btn-sec{background:transparent;border:1px solid var(--line);color:var(--text);width:100%;padding:12px;border-radius:10px;font-size:13.5px;cursor:pointer;margin-top:8px;}
  .msg{font-size:12.5px;color:var(--muted);margin-top:10px;min-height:16px;}
  .msg.erro{color:#ff8b8b;}
  .msg.ok{color:var(--accent);}
  .tabs{display:flex;gap:8px;margin-bottom:18px;}
  .tab{flex:1;text-align:center;padding:10px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;background:var(--card);border:1px solid var(--line);color:var(--muted);}
  .tab.ativa{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}
  .preco-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px;}
  .preco-label{font-size:13px;color:var(--muted);}
  .preco{font-size:28px;font-weight:700;color:var(--accent);}
  .pedido-item{border-bottom:1px solid var(--line);padding:12px 0;}
  .pedido-item:last-child{border-bottom:none;}
  .pedido-top{display:flex;justify-content:space-between;font-size:13.5px;font-weight:700;}
  .pedido-sub{font-size:12px;color:var(--muted);margin-top:4px;}
  .status-pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
  .status-pill.executando{background:#3a2f1f;color:#ffc97c;}
  .status-pill.concluido{background:var(--accent-dim);color:var(--accent);}
  .status-pill.aguardando_pagamento{background:#23272d;color:var(--muted);}
  .status-pill.cancelado, .status-pill.erro_fornecedor{background:#3a1f1f;color:#ff8b8b;}
  .float-whats{
    position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;
    background:#25D366;display:flex;align-items:center;justify-content:center;
    font-size:26px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);text-decoration:none;
  }
  .top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;font-size:13px;color:var(--muted);padding-top:16px;}
  .top-bar button{background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;}
  .hidden{display:none !important;}

  /* ===== HERO DE LOGIN ===== */
  .auth-hero{
    position:relative;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    padding:32px 16px;
    background: linear-gradient(135deg, #0b0d10 0%, #0d1a12 50%, #0b0d10 100%);
  }
  .auth-hero::before{
    content:'';
    position:absolute;
    inset:0;
    background: radial-gradient(ellipse at 20% 50%, rgba(124,255,178,.07) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 20%, rgba(124,255,178,.05) 0%, transparent 50%);
    pointer-events:none;
  }
  /* ícones flutuantes no fundo */
  .floating-icons{
    position:absolute;
    inset:0;
    pointer-events:none;
    overflow:hidden;
  }
  .fi{
    position:absolute;
    font-size:32px;
    opacity:.06;
    animation: floatUp linear infinite;
    user-select:none;
  }
  @keyframes floatUp{
    0%  { transform: translateY(110vh) rotate(0deg);   opacity:0;   }
    5%  { opacity:.08; }
    95% { opacity:.08; }
    100%{ transform: translateY(-20vh) rotate(360deg); opacity:0;   }
  }
  /* card de login flutuante */
  .auth-card{
    position:relative;
    z-index:2;
    width:100%;
    max-width:380px;
    background:rgba(21,24,28,.92);
    border:1px solid rgba(124,255,178,.15);
    border-radius:24px;
    padding:36px 32px;
    backdrop-filter:blur(12px);
    box-shadow:0 24px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(124,255,178,.05);
  }
  .auth-logo{
    text-align:center;
    margin-bottom:24px;
  }
  .auth-logo .logo-circle{
    width:64px;height:64px;border-radius:50%;
    background:linear-gradient(135deg, #7CFFB2, #00c97a);
    display:inline-flex;align-items:center;justify-content:center;
    font-size:28px;margin-bottom:12px;
    box-shadow:0 8px 24px rgba(124,255,178,.3);
  }
  .auth-logo h1{
    font-size:20px;font-weight:800;margin:0 0 4px;
    background:linear-gradient(135deg,#7CFFB2,#fff);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  }
  .auth-logo p{font-size:12.5px;color:var(--muted);margin:0;}
  .auth-divider{
    display:flex;align-items:center;gap:10px;margin:18px 0;
  }
  .auth-divider span{font-size:11px;color:var(--muted);white-space:nowrap;}
  .auth-divider::before,.auth-divider::after{
    content:'';flex:1;height:1px;background:var(--line);
  }
  .auth-input{
    width:100%;background:rgba(14,16,19,.8);border:1px solid var(--line);
    color:var(--text);padding:13px 16px;border-radius:12px;font-size:14px;
    outline:none;margin-bottom:12px;transition:border-color .2s,box-shadow .2s;
  }
  .auth-input:focus{
    border-color:var(--accent);
    box-shadow:0 0 0 3px rgba(124,255,178,.1);
  }
  .auth-btn{
    width:100%;background:linear-gradient(135deg,#7CFFB2,#00c97a);
    color:#061409;border:none;padding:14px;border-radius:12px;
    font-size:15px;font-weight:800;cursor:pointer;
    transition:filter .15s,transform .1s;
    letter-spacing:.02em;
  }
  .auth-btn:hover{filter:brightness(1.08);}
  .auth-btn:active{transform:scale(.98);}
  .auth-toggle{
    text-align:center;margin-top:16px;font-size:13px;color:var(--muted);
  }
  .auth-toggle button{
    background:none;border:none;color:var(--accent);
    font-size:13px;font-weight:700;cursor:pointer;padding:0;
  }
  .auth-msg{font-size:12.5px;margin-top:10px;min-height:16px;text-align:center;}
  .auth-msg.erro{color:#ff8b8b;}
  .auth-msg.ok{color:var(--accent);}
  .redes-badges{
    display:flex;justify-content:center;gap:10px;margin-bottom:22px;flex-wrap:wrap;
  }
  .rede-badge{
    display:flex;align-items:center;gap:5px;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
    border-radius:20px;padding:5px 12px;font-size:12px;color:var(--muted);
  }
</style>
</head>
<body>

<!-- HERO DE LOGIN -->
<div class="auth-hero" id="auth-hero">

  <!-- ícones flutuando no fundo -->
  <div class="floating-icons" id="floating-icons"></div>

  <!-- card central -->
  <div class="auth-card" id="auth-card">

    <div class="auth-logo">
      <div class="logo-circle">🚀</div>
      <h1>Engaja aí</h1>
      <p>Impulsione seu perfil nas redes sociais</p>
    </div>

    <div class="redes-badges">
      <div class="rede-badge">📸 Instagram</div>
      <div class="rede-badge">🎵 TikTok</div>
      <div class="rede-badge">▶️ YouTube</div>
      <div class="rede-badge">𝕏 Twitter</div>
      <div class="rede-badge">📘 Facebook</div>
    </div>

    <div class="auth-divider"><span>Acesse sua conta</span></div>

    <input class="auth-input" id="auth-whats" placeholder="📱 WhatsApp (com DDD)" type="tel">
    <input class="auth-input" id="auth-senha" placeholder="🔒 Senha" type="password">
    <input class="auth-input hidden" id="auth-nome" placeholder="👤 Seu nome">

    <button class="auth-btn" id="btn-login">Entrar</button>

    <div class="auth-toggle">
      <button id="btn-toggle-cadastro">Não tenho conta — criar uma</button>
    </div>

    <p class="auth-msg" id="auth-msg"></p>
  </div>
</div>

<!-- ÁREA LOGADO -->
<div class="hidden" id="area-logada">
<div class="container">
  <div class="top-bar" id="top-bar">
    <span id="saudacao">Visitante</span>
    <div style="display:flex;align-items:center;gap:12px;">
      <span id="saldo-display" style="font-size:13px;color:var(--accent);font-weight:700;cursor:pointer;" title="Ver carteira">💰 R$ 0,00</span>
      <button id="btn-login-logout">Sair</button>
    </div>
  </div>

  <!-- ABAS -->
  <div class="tabs hidden" id="tabs">
    <div class="tab ativa" id="tab-engajar">🚀 Engajar</div>
    <div class="tab" id="tab-pedidos">📦 Pedidos</div>
    <div class="tab" id="tab-carteira">💰 Carteira</div>
  </div>

  <!-- WIDGET DE ENGAJAMENTO -->
  <div id="painel-engajar" class="hidden">
    <div class="card">
      <p class="eyebrow">Disponível agora</p>
      <h2 class="title">Chegou a hora de engajar o seu perfil</h2>
      <p class="sub">Escolha a rede, o serviço e cole o link — em poucos segundos você vê o valor.</p>

      <label class="label">Rede social</label>
      <select class="select" id="eng-rede"><option value="">Carregando...</option></select>

      <label class="label">Tipo de serviço</label>
      <select class="select" id="eng-tipo" disabled><option value="">Selecione a rede social primeiro</option></select>

      <label class="label">Opção</label>
      <select class="select" id="eng-opcao" disabled><option value="">Selecione o tipo de serviço</option></select>

      <label class="label">Link do perfil ou post</label>
      <input class="input" id="eng-link" type="url" placeholder="https://instagram.com/seuperfil" disabled>

      <label class="label">Quantidade</label>
      <input class="input" id="eng-qtd" type="number" placeholder="Ex: 500" disabled>

      <div id="eng-resultado" class="hidden">
        <div class="preco-row">
          <span class="preco-label">Valor total</span>
          <span class="preco" id="eng-preco">R$ 0,00</span>
        </div>
        <!-- Opções de pagamento -->
        <div id="opcoes-pagamento" style="display:flex;gap:8px;margin-bottom:14px;">
          <button class="btn" id="eng-pagar-saldo" style="flex:1;background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);">💰 Pagar com saldo</button>
          <button class="btn" id="eng-pagar-pix" style="flex:1;">📱 Gerar PIX</button>
        </div>
      </div>

      <p class="msg" id="eng-msg"></p>
    </div>
  </div>

  <!-- MEUS PEDIDOS -->
  <div id="painel-pedidos" class="hidden">
    <div class="card">
      <p class="eyebrow">Histórico</p>
      <h2 class="title">Meus pedidos</h2>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <p style="font-size:12px;color:var(--muted);margin:0;">Atualiza automaticamente a cada 30 segundos</p>
        <button class="btn-sec" id="btn-atualizar-pedidos" style="width:auto;padding:8px 14px;font-size:12.5px;">🔄 Atualizar agora</button>
      </div>
      <div id="lista-pedidos"></div>
      <p class="msg" id="pedidos-msg"></p>
    </div>
  </div>

  <!-- CARTEIRA -->
  <div id="painel-carteira" class="hidden">
    <div class="card">
      <p class="eyebrow">Minha carteira</p>
      <h2 class="title">Saldo disponível</h2>
      <div style="text-align:center;padding:20px 0;">
        <div style="font-size:42px;font-weight:800;color:var(--accent);" id="saldo-carteira">R$ 0,00</div>
        <p style="font-size:12.5px;color:var(--muted);margin-top:8px;">Use seu saldo pra pagar pedidos instantaneamente</p>
      </div>
      <label class="label">Valor do depósito (mínimo R$ 5,00)</label>
      <input class="input" id="deposito-valor" type="number" min="5" placeholder="Ex: 50.00">
      <button class="btn" id="deposito-btn">Gerar PIX pra recarregar</button>
      <div id="deposito-qr" style="display:none;margin-top:16px;text-align:center;"></div>
      <p class="msg" id="deposito-msg"></p>
    </div>
  </div>

  <!-- ABRIR TICKET -->
  <div class="card">
    <p class="eyebrow">Precisa de ajuda?</p>
    <h2 class="title" style="font-size:16px;">Fale com o suporte</h2>
    <input class="input" id="ticket-mensagem" placeholder="Descreva sua dúvida ou problema...">
    <button class="btn-sec" id="ticket-enviar">Enviar mensagem de suporte</button>
    <p class="msg" id="ticket-msg"></p>
  </div>

</div><!-- /container -->
</div><!-- /area-logada -->

<a class="float-whats hidden" id="float-whats" target="_blank">💬</a>

<script>
(function(){
  const API_BASE = '';
  const $ = (id) => document.getElementById(id);

  let clienteId = localStorage.getItem('eng_clienteId') || null;
  let clienteNome = localStorage.getItem('eng_clienteNome') || '';
  let modoCadastro = false;
  let whatsappSuporte = '';

  function atualizarTopBar(){
    if(clienteId){
      $('auth-hero').classList.add('hidden');
      $('area-logada').classList.remove('hidden');
      $('saudacao').textContent = clienteNome ? `Olá, ${clienteNome}` : 'Logado';
      $('tabs').classList.remove('hidden');
      $('painel-engajar').classList.remove('hidden');
      carregarSaldo();
    } else {
      $('auth-hero').classList.remove('hidden');
      $('area-logada').classList.add('hidden');
      $('painel-pedidos').classList.add('hidden');
      $('painel-carteira').classList.add('hidden');
    }
  }

  $('btn-login-logout').addEventListener('click', () => {
    localStorage.removeItem('eng_clienteId');
    localStorage.removeItem('eng_clienteNome');
    clienteId = null; clienteNome = '';
    atualizarTopBar();
  });

  $('btn-toggle-cadastro').addEventListener('click', () => {
    modoCadastro = !modoCadastro;
    $('auth-nome').classList.toggle('hidden', !modoCadastro);
    $('btn-login').textContent = modoCadastro ? 'Criar conta' : 'Entrar';
    $('btn-toggle-cadastro').textContent = modoCadastro ? 'Já tenho conta — entrar' : 'Não tenho conta — criar uma';
  });

  $('btn-login').addEventListener('click', async () => {
    const whatsapp = $('auth-whats').value;
    const senha = $('auth-senha').value;
    const nome = $('auth-nome').value;
    if(!whatsapp || !senha){ msgAuth('Preenche WhatsApp e senha', 'erro'); return; }

    try{
      const r = await fetch(`${API_BASE}/api/auth-cliente`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ acao: modoCadastro ? 'cadastro' : 'login', whatsapp, senha, nome })
      });
      const data = await r.json();
      if(!r.ok){ msgAuth(data.erro || 'Erro', 'erro'); return; }
      clienteId = data.clienteId;
      clienteNome = data.nome || '';
      localStorage.setItem('eng_clienteId', clienteId);
      localStorage.setItem('eng_clienteNome', clienteNome);
      atualizarTopBar();
    }catch(e){
      msgAuth('Erro de conexão', 'erro');
    }
  });

  function msgAuth(texto, tipo){
    $('auth-msg').textContent = texto;
    $('auth-msg').className = 'msg' + (tipo ? ' ' + tipo : '');
  }

  // ===== Abas =====
  $('tab-engajar').addEventListener('click', () => {
    ativarAba('engajar');
  });
  $('tab-pedidos').addEventListener('click', () => {
    ativarAba('pedidos');
    carregarMeusPedidos();
  });
  $('tab-carteira').addEventListener('click', () => {
    ativarAba('carteira');
    carregarSaldo();
  });
  $('saldo-display').addEventListener('click', () => {
    ativarAba('carteira');
    carregarSaldo();
  });

  function ativarAba(aba){
    ['engajar','pedidos','carteira'].forEach(a => {
      $(`tab-${a}`)?.classList.remove('ativa');
      $(`painel-${a}`)?.classList.add('hidden');
    });
    $(`tab-${aba}`)?.classList.add('ativa');
    $(`painel-${aba}`)?.classList.remove('hidden');
  }

  let intervaloPedidos = null;

  async function carregarMeusPedidos(){
    if(!clienteId) return;
    try{
      const r = await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data = await r.json();
      const lista = $('lista-pedidos');
      lista.innerHTML = '';
      if(!data.pedidos || data.pedidos.length === 0){
        $('pedidos-msg').textContent = 'Você ainda não fez nenhum pedido.';
        return;
      }
      $('pedidos-msg').textContent = '';

      // sincroniza status dos pedidos em andamento com o fornecedor
      const emAndamento = (data.pedidos || []).filter(p => p.status === 'executando' && p.orderIdFornecedor);
      await Promise.all(emAndamento.map(p =>
        fetch(`${API_BASE}/api/pedidos?pedidoId=${encodeURIComponent(p.id)}`).catch(() => {})
      ));

      // recarrega após sincronizar
      const r2 = await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data2 = await r2.json();
      const pedidos = data2.pedidos || data.pedidos;

      pedidos.forEach((p) => {
        const progresso = p.startCount && p.quantidade
          ? Math.min(100, Math.round(((p.quantidade - (p.restam || p.quantidade)) / p.quantidade) * 100))
          : (p.status === 'concluido' ? 100 : p.status === 'executando' ? 50 : 0);

        const corStatus = {
          aguardando_pagamento: '#8b929b',
          executando: '#ffc97c',
          concluido: '#7CFFB2',
          cancelado: '#ff8b8b',
          erro_fornecedor: '#ff8b8b',
        };
        const cor = corStatus[p.status] || '#8b929b';

        const div = document.createElement('div');
        div.className = 'pedido-item';
        div.innerHTML = `
          <div class="pedido-top">
            <span>${p.nomeServico || 'Serviço'}</span>
            <span class="status-pill ${p.status}">${formatarStatus(p.status)}</span>
          </div>
          <div class="pedido-sub">
            Qtd: ${p.quantidade} · R$ ${Number(p.valorTotal).toFixed(2)} · ${new Date(p.criadoEm).toLocaleDateString('pt-BR')}
            ${p.pagamento === 'saldo' ? ' · 💰 Saldo' : ''}
          </div>
          ${p.status === 'executando' || p.status === 'concluido' ? `
          <div style="margin-top:8px;">
            <div style="height:4px;background:var(--line);border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${progresso}%;background:${cor};border-radius:4px;transition:width .5s;"></div>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">${progresso}% concluído${p.restam ? ` · ${p.restam} restando` : ''}</div>
          </div>` : ''}
        `;
        lista.appendChild(div);
      });
    }catch(e){
      $('pedidos-msg').textContent = 'Erro ao carregar pedidos.';
    }
  }

  // atualização automática a cada 30s quando estiver na aba de pedidos
  function iniciarAtualizacaoPedidos(){
    if(intervaloPedidos) clearInterval(intervaloPedidos);
    intervaloPedidos = setInterval(() => {
      if(!$('painel-pedidos').classList.contains('hidden')){
        carregarMeusPedidos();
      }
    }, 30000);
  }

  $('btn-atualizar-pedidos').addEventListener('click', () => {
    $('btn-atualizar-pedidos').textContent = '⏳ Atualizando...';
    $('btn-atualizar-pedidos').disabled = true;
    carregarMeusPedidos().then(() => {
      $('btn-atualizar-pedidos').textContent = '🔄 Atualizar agora';
      $('btn-atualizar-pedidos').disabled = false;
    });
  });

  function formatarStatus(s){
    const mapa = {
      aguardando_pagamento: 'Aguardando pagamento',
      executando: 'Em andamento',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
      erro_fornecedor: 'Erro - contate o suporte',
    };
    return mapa[s] || s;
  }

  // ===== Widget de engajamento =====
  const elRede = $('eng-rede');
  const elTipo = $('eng-tipo');
  const elOpcao = $('eng-opcao');
  const elLink = $('eng-link');
  const elQtd = $('eng-qtd');
  const elResultado = $('eng-resultado');
  const elPreco = $('eng-preco');

  let servicosDoTipo = [];
  let servicoSelecionado = null;

  function msgEng(texto, tipo){
    $('eng-msg').textContent = texto || '';
    $('eng-msg').className = 'msg' + (tipo ? ' ' + tipo : '');
  }

  function capitalizar(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

  async function carregarFiltrosIniciais(){
    try{
      const r = await fetch(`${API_BASE}/api/services`);
      const data = await r.json();
      elRede.innerHTML = '<option value="">Selecione</option>' +
        (data.redesSociais || []).map(r => `<option value="${r}">${capitalizar(r)}</option>`).join('');
    }catch(e){ msgEng('Não foi possível carregar as redes sociais.', 'erro'); }
  }

  elRede.addEventListener('change', async () => {
    resetDe('tipo');
    if(!elRede.value) return;
    const r = await fetch(`${API_BASE}/api/services?redeSocial=${encodeURIComponent(elRede.value)}`);
    const data = await r.json();
    const tipos = [...new Set((data.servicos || []).map(s => s.servicoTipo))].filter(Boolean);
    elTipo.innerHTML = '<option value="">Selecione</option>' +
      tipos.map(t => `<option value="${t}">${capitalizar(t)}</option>`).join('');
    elTipo.disabled = false;
  });

  elTipo.addEventListener('change', async () => {
    resetDe('opcao');
    if(!elTipo.value) return;
    const r = await fetch(`${API_BASE}/api/services?redeSocial=${encodeURIComponent(elRede.value)}&servicoTipo=${encodeURIComponent(elTipo.value)}`);
    const data = await r.json();
    servicosDoTipo = data.servicos || [];
    elOpcao.innerHTML = '<option value="">Selecione</option>' +
      servicosDoTipo.map(s => `<option value="${s.id}">${s.icone ? s.icone + ' ' : ''}${s.nome} (R$ ${s.precoPorMil.toFixed(2)}/1000)</option>`).join('');
    elOpcao.disabled = false;
  });

  elOpcao.addEventListener('change', () => {
    servicoSelecionado = servicosDoTipo.find(s => String(s.id) === elOpcao.value) || null;
    elLink.disabled = !servicoSelecionado;
    elQtd.disabled = !servicoSelecionado;
    if(servicoSelecionado) elQtd.placeholder = `Entre ${servicoSelecionado.min} e ${servicoSelecionado.max}`;
    elResultado.classList.add('hidden');
  });

  elQtd.addEventListener('input', atualizarPreco);
  elLink.addEventListener('input', atualizarPreco);

  function atualizarPreco(){
    if(!servicoSelecionado || !elLink.value || !elQtd.value){ elResultado.classList.add('hidden'); return; }
    const qtd = Number(elQtd.value);
    if(qtd < servicoSelecionado.min || qtd > servicoSelecionado.max){ elResultado.classList.add('hidden'); return; }
    const total = (servicoSelecionado.precoPorMil * qtd) / 1000;
    elPreco.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    elResultado.classList.remove('hidden');
  }

  function resetDe(nivel){
    if(nivel === 'tipo'){
      elTipo.innerHTML = '<option value="">Selecione a rede social primeiro</option>';
      elTipo.disabled = true;
    }
    elOpcao.innerHTML = '<option value="">Selecione o tipo de serviço</option>';
    elOpcao.disabled = true;
    elLink.value = ''; elLink.disabled = true;
    elQtd.value = ''; elQtd.disabled = true;
    elResultado.classList.add('hidden');
    servicoSelecionado = null;
  }

  // ===== Saldo / Carteira =====
  let saldoAtual = 0;

  async function carregarSaldo(){
    if(!clienteId) return;
    try{
      const r = await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`);
      const data = await r.json();
      saldoAtual = Number(data.saldo || 0);
      $('saldo-display').textContent = `💰 R$ ${saldoAtual.toFixed(2)}`;
      if($('saldo-carteira')) $('saldo-carteira').textContent = `R$ ${saldoAtual.toFixed(2)}`;
    }catch(e){}
  }

  $('deposito-btn').addEventListener('click', async () => {
    const valor = Number($('deposito-valor').value);
    if(!valor || valor < 5){ $('deposito-msg').textContent = 'Valor mínimo é R$ 5,00'; $('deposito-msg').className = 'msg erro'; return; }
    $('deposito-btn').disabled = true;
    $('deposito-msg').textContent = 'Gerando PIX...';
    try{
      const r = await fetch(`${API_BASE}/api/carteira`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ clienteId, valor }),
      });
      const data = await r.json();
      if(!r.ok){ $('deposito-msg').textContent = data.erro || 'Erro'; $('deposito-msg').className = 'msg erro'; $('deposito-btn').disabled = false; return; }
      const qrDiv = $('deposito-qr');
      qrDiv.innerHTML = `
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">Escaneie ou copie o código PIX</p>
        ${data.qrCodeBase64 ? `<img src="data:image/png;base64,${data.qrCodeBase64}" style="width:180px;height:180px;border-radius:12px;margin-bottom:12px;display:block;margin:0 auto 12px;">` : ''}
        ${data.qrCode ? `<textarea style="width:100%;background:#0e1013;border:1px solid var(--line);color:var(--accent);padding:10px;border-radius:8px;font-size:11px;resize:none;height:60px;" readonly>${data.qrCode}</textarea>
        <button class="btn" style="margin-top:8px;" onclick="navigator.clipboard.writeText(this.dataset.code);this.textContent='Copiado ✓'" data-code="${data.qrCode}">📋 Copiar código PIX</button>` : ''}
        <p style="font-size:12px;color:var(--muted);margin-top:12px;">Valor: <strong style="color:var(--accent)">R$ ${Number(data.valor).toFixed(2)}</strong></p>
        <p style="font-size:11px;color:var(--muted);">Após o pagamento, seu saldo será atualizado automaticamente.</p>
      `;
      qrDiv.style.display = 'block';
      $('deposito-msg').textContent = 'PIX gerado!';
      $('deposito-msg').className = 'msg ok';
    }catch(e){
      $('deposito-msg').textContent = 'Erro de conexão.';
      $('deposito-msg').className = 'msg erro';
    }
    $('deposito-btn').disabled = false;
  });

  $('eng-pagar-saldo').addEventListener('click', async () => {
    if(!servicoSelecionado || !clienteId) return;
    const qtd = Number($('eng-qtd').value);
    const valorTotal = (servicoSelecionado.precoPorMil * qtd) / 1000;

    // busca saldo atualizado antes de processar
    try{
      const rSaldo = await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`);
      const dataSaldo = await rSaldo.json();
      saldoAtual = Number(dataSaldo.saldo || 0);
      $('saldo-display').textContent = `💰 R$ ${saldoAtual.toFixed(2)}`;
    }catch(e){}

    if(saldoAtual < valorTotal){
      msgEng(`Saldo insuficiente (R$ ${saldoAtual.toFixed(2)}). Recarregue na aba Carteira.`, 'erro');
      return;
    }
    $('eng-pagar-saldo').disabled = true;
    msgEng('Processando com saldo...');
    try{
      const r = await fetch(`${API_BASE}/api/order`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ idFornecedor: servicoSelecionado.id, link: elLink.value, quantidade: qtd, clienteId, pagarComSaldo: true }),
      });
      const data = await r.json();
      if(!r.ok){ msgEng(data.erro || 'Erro', 'erro'); $('eng-pagar-saldo').disabled = false; return; }
      saldoAtual = data.novoSaldo || 0;
      $('saldo-display').textContent = `💰 R$ ${saldoAtual.toFixed(2)}`;
      msgEng(`✅ Pedido enviado! Novo saldo: R$ ${saldoAtual.toFixed(2)}`, 'ok');
    }catch(e){ msgEng('Erro de conexão.', 'erro'); }
    $('eng-pagar-saldo').disabled = false;
  });

  $('eng-pagar-pix').addEventListener('click', async () => {
    if(!servicoSelecionado || !clienteId){ msgEng('Faça login pra continuar.', 'erro'); return; }
    $('eng-pagar-pix').disabled = true;
    msgEng('Criando pedido...');
    try{
      const r = await fetch(`${API_BASE}/api/order`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ idFornecedor: servicoSelecionado.id, link: elLink.value, quantidade: Number($('eng-qtd').value), clienteId, pagarComSaldo: false }),
      });
      const data = await r.json();
      if(!r.ok){ msgEng(data.erro || 'Erro ao criar pedido', 'erro'); $('eng-pagar-pix').disabled = false; return; }
      msgEng('Gerando PIX...');
      const rPix = await fetch(`${API_BASE}/api/pagamento`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ pedidoId: data.pedidoId }),
      });
      const pix = await rPix.json();
      if(!rPix.ok){ msgEng(pix.erro || 'Erro ao gerar PIX.', 'erro'); $('eng-pagar-pix').disabled = false; return; }
      let qrHtml = `<div style="text-align:center;padding:20px 0;border-top:1px solid var(--line);margin-top:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">📱 Escaneie o QR Code ou copie o código PIX</p>`;
      if(pix.qrCodeBase64) qrHtml += `<img src="data:image/png;base64,${pix.qrCodeBase64}" style="width:180px;height:180px;border-radius:12px;margin-bottom:12px;display:block;margin:0 auto 12px;">`;
      if(pix.qrCode) qrHtml += `<textarea style="width:100%;background:#0e1013;border:1px solid var(--line);color:var(--accent);padding:10px;border-radius:8px;font-size:11px;resize:none;height:60px;" readonly>${pix.qrCode}</textarea>
        <button class="btn" style="margin-top:8px;" onclick="navigator.clipboard.writeText(this.dataset.code);this.textContent='Copiado ✓'" data-code="${pix.qrCode}">📋 Copiar código PIX</button>`;
      qrHtml += `<p style="font-size:12px;color:var(--muted);margin-top:12px;">Valor: <strong style="color:var(--accent)">R$ ${Number(data.valorTotal).toFixed(2)}</strong></p>
        <p style="font-size:11px;color:var(--muted);">Após o pagamento, seu pedido é processado automaticamente.</p></div>`;
      let qrContainer = document.getElementById('pix-qr-container');
      if(!qrContainer){ qrContainer = document.createElement('div'); qrContainer.id = 'pix-qr-container'; $('eng-pagar-pix').closest('.card').appendChild(qrContainer); }
      qrContainer.innerHTML = qrHtml;
      msgEng('PIX gerado! Escaneie o QR Code abaixo.', 'ok');
    }catch(e){ msgEng('Erro de conexão.', 'erro'); }
    $('eng-pagar-pix').disabled = false;
  });

  // ===== Ticket de suporte =====
  $('ticket-enviar').addEventListener('click', async () => {
    const mensagem = $('ticket-mensagem').value;
    if(!mensagem){ return; }
    try{
      const r = await fetch(`${API_BASE}/api/tickets`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ clienteId, nome: clienteNome, mensagem })
      });
      if(r.ok){
        $('ticket-msg').textContent = 'Mensagem enviada! Vamos te responder em breve.';
        $('ticket-msg').className = 'msg ok';
        $('ticket-mensagem').value = '';
      } else {
        $('ticket-msg').textContent = 'Erro ao enviar. Tente o WhatsApp abaixo.';
        $('ticket-msg').className = 'msg erro';
      }
    }catch(e){
      $('ticket-msg').textContent = 'Erro de conexão.';
      $('ticket-msg').className = 'msg erro';
    }
  });

  // ===== WhatsApp flutuante =====
  async function carregarSuporte(){
    try{
      const r = await fetch(`${API_BASE}/api/config`);
      const data = await r.json();
      if(data.whatsappSuporte){
        whatsappSuporte = data.whatsappSuporte;
        const el = $('float-whats');
        el.href = `https://wa.me/${whatsappSuporte}`;
        el.classList.remove('hidden');
      }
    }catch(e){}
  }

  // ===== Ícones flutuantes no fundo do login =====
  function gerarIconesFlutuantes(){
    const container = $('floating-icons');
    if(!container) return;
    const icones = ['📸','❤️','👥','💬','▶️','⭐','🔥','📊','🚀','✨','🎯','📱','🎵','𝕏','📘'];
    for(let i = 0; i < 30; i++){
      const el = document.createElement('div');
      el.className = 'fi';
      el.textContent = icones[Math.floor(Math.random() * icones.length)];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.animationDuration = (12 + Math.random() * 20) + 's';
      el.style.animationDelay = (Math.random() * 20) + 's';
      el.style.fontSize = (20 + Math.random() * 28) + 'px';
      container.appendChild(el);
    }
  }

  atualizarTopBar();
  carregarFiltrosIniciais();
  carregarSuporte();
  gerarIconesFlutuantes();
  iniciarAtualizacaoPedidos();
})();
</script>

</body>
</html>
