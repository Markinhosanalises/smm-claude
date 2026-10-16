(function(){
  const API_BASE = '';
  const fetch = window.smmFetch;
  const $ = (id) => document.getElementById(id);
  let lucroGlobalAtual = 30;
  let cotacaoAtual = 0;

  $('login-btn').addEventListener('click', async () => {
    const credential = $('login-pin').value;
    if(!credential){ $('login-msg').textContent = 'Digite sua credencial'; return; }
    try {
      const r = await fetch('/api/auth-cliente', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'admin-login',pin:credential})});
      $('login-pin').value='';
      if(r.ok){ entrarNoAdmin(); } else { const d=await r.json(); $('login-msg').textContent=d.erro||'Credencial inválida'; }
    } catch { $('login-msg').textContent='Erro de conexão'; }
  });

  async function entrarNoAdmin(){
    $('login-gate').style.display = 'none';
    $('painel').style.display = 'block';
    await carregarConfig(); carregarServicos(); carregarPedidos();
    carregarTickets(); carregarClientes(); carregarIntegracoes(); carregarVitrine(); carregarRevendedores();
  }

  localStorage.removeItem('admin_pin');
  fetch('/api/auth-cliente?acao=admin-session').then(r => { if(r.ok) entrarNoAdmin(); }).catch(()=>{});
  const logoutButton=document.createElement('button'); logoutButton.textContent='Sair'; logoutButton.className='secundario';
  logoutButton.addEventListener('click',async()=>{ await fetch('/api/auth-cliente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'admin-logout'})}); location.reload(); });
  $('painel').prepend(logoutButton);

  async function carregarConfig(){
    const r = await fetch(`${API_BASE}/api/config?`);
    const data = await r.json();
    $('cfg-url').value = data.url || '';
    $('cfg-lucro').value = data.lucroPercentualGlobal ?? 30;
    $('cfg-cotacao').value = data.cotacaoUSDBRL || '';
    $('cfg-whats').value = data.whatsappSuporte || '';
    $('cfg-min-recarga').value = data.minRecarga || '';
    $('cfg-ordem-servicos').value = data.ordemServicos || 'padrao';
    lucroGlobalAtual = Number(data.lucroPercentualGlobal ?? 30);
    cotacaoAtual = Number(data.cotacaoUSDBRL || 0);
  }

  $('cfg-salvar').addEventListener('click', async () => {
    const body = { lucroPercentualGlobal: $('cfg-lucro').value, cotacaoUSDBRL: $('cfg-cotacao').value, whatsappSuporte: $('cfg-whats').value, minRecarga: $('cfg-min-recarga').value ? Number($('cfg-min-recarga').value) : null, ordemServicos: $('cfg-ordem-servicos').value };
    if($('cfg-url').value && $('cfg-key').value){ body.url = $('cfg-url').value; body.key = $('cfg-key').value; }
    const r = await fetch(`${API_BASE}/api/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await r.json();
    $('cfg-msg').textContent = r.ok ? 'Configuração salva.' : (data.erro || 'Erro');
    $('cfg-msg').className = 'msg ' + (r.ok ? 'ok' : 'erro');
    if(r.ok){ lucroGlobalAtual = Number($('cfg-lucro').value || 30); cotacaoAtual = Number($('cfg-cotacao').value || 0); atualizarPrecosServicos(); }
  });

  $('cfg-saldo-btn').addEventListener('click', async () => {
    const r = await fetch(`${API_BASE}/api/config?action=balance`);
    const data = await r.json();
    $('cfg-saldo').value = r.ok ? `${data.saldo} ${data.moeda}` : (data.erro || 'erro');
  });

  $('sync-btn').addEventListener('click', async () => {
    $('sync-msg').textContent = 'Sincronizando...';
    const r = await fetch(`${API_BASE}/api/sync-services`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ }) });
    const data = await r.json();
    if(r.ok){ $('sync-msg').textContent = `${data.totalServicos} serviços sincronizados.`; $('sync-msg').className = 'msg ok'; carregarServicos(); }
    else { $('sync-msg').textContent = data.erro || 'Erro ao sincronizar'; $('sync-msg').className = 'msg erro'; }
  });

  $('detectar-redes-btn').addEventListener('click', async () => {
    $('sync-msg').textContent = 'Detectando redes automaticamente... (pode demorar alguns segundos)';
    $('sync-msg').className = 'msg';
    $('detectar-redes-btn').disabled = true;
    try{
      const r = await fetch(`${API_BASE}/api/sync-services`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: 'detectar' }) });
      const data = await r.json();
      if(r.ok){
        $('sync-msg').textContent = `✅ ${data.atualizados} serviços atualizados de ${data.total} total.`;
        $('sync-msg').className = 'msg ok';
        carregarServicos();
      } else {
        $('sync-msg').textContent = data.erro || 'Erro';
        $('sync-msg').className = 'msg erro';
      }
    }catch(e){
      $('sync-msg').textContent = 'Erro de conexão.';
      $('sync-msg').className = 'msg erro';
    }
    $('detectar-redes-btn').disabled = false;
  });

  async function carregarServicos(termo, somenteAtivos, somenteIndisponiveis){
    const q = termo ? `&busca=${encodeURIComponent(termo)}` : '';
    const qAtivos = somenteAtivos ? `&somenteAtivos=1` : '';
    const qIndisp = somenteIndisponiveis ? `&somenteIndisponiveis=1` : '';
    const ordem = $('ordenar-servico').value;
    const qOrdem = ordem ? `&ordenar=${ordem}` : '';
    let data;
    try {
      const r = await fetch(`${API_BASE}/api/admin-services?${q}${qAtivos}${qIndisp}${qOrdem}`);
      data = await r.json();
      if(!r.ok){ $('servicos-msg').textContent = data.erro || `Erro ${r.status}`; $('servicos-msg').className = 'msg erro'; return; }
    } catch(e) { $('servicos-msg').textContent = 'Falha na busca. Tente novamente.'; $('servicos-msg').className = 'msg erro'; return; }

    // mostra última verificação automática
    try{
      const rc = await fetch(`${API_BASE}/api/config?`);
      const dc = await rc.json();
      if(dc.ultimaVerificacaoFornecedor){
        const dt = new Date(dc.ultimaVerificacaoFornecedor).toLocaleString('pt-BR');
        const res = dc.ultimaVerificacaoResultado || {};
        $('ultima-verificacao').textContent = `🕐 Última verificação automática: ${dt} · ${res.desativados||0} desativados · ${res.reativados||0} reativados`;
      }
    }catch(e){}

    const tbody = $('tabela-servicos-body');
    tbody.innerHTML = safeHTML('');
    if(!termo && !somenteIndisponiveis){ $('servicos-msg').textContent = `${data.total} serviços no catálogo. Digite algo na busca pra filtrar.`; $('servicos-msg').className = 'msg'; }
    else { $('servicos-msg').textContent = data.limitado ? `${data.total} resultados — mostrando os primeiros 200.` : `${data.total} resultado(s).`; $('servicos-msg').className = 'msg'; }

    (data.servicos || []).forEach((s) => {
      const tr = document.createElement('tr');
      if(s.indisponivel) tr.style.background = 'rgba(255,80,80,.06)';
      const precoFinalInicial = calcularPrecoFinal(s.taxaCusto, s.lucroPercentual);
      tr.innerHTML = safeRowHTML(`
        <td><input type="checkbox" ${escapeHTML(s.ativo ? 'checked' : '')} data-campo="ativo" data-id="${escapeHTML(s.idFornecedor)}"></td>
        <td>
          <select data-campo="icone" data-id="${escapeHTML(s.idFornecedor)}">
            <option value="" ${escapeHTML(!s.icone?'selected':'')}>Sem ícone</option>
            <option value="🇧🇷" ${escapeHTML(s.icone==='🇧🇷'?'selected':'')}>🇧🇷 Brasil</option>
            <option value="🌍" ${escapeHTML(s.icone==='🌍'?'selected':'')}>🌍 Mundial</option>
            <option value="⭐" ${escapeHTML(s.icone==='⭐'?'selected':'')}>⭐ Premium</option>
            <option value="⚡" ${escapeHTML(s.icone==='⚡'?'selected':'')}>⚡ Entrega rápida</option>
            <option value="🔒" ${escapeHTML(s.icone==='🔒'?'selected':'')}>🔒 Garantido/Refill</option>
            <option value="👥" ${escapeHTML(s.icone==='👥'?'selected':'')}>👥 Seguidores</option>
            <option value="❤️" ${escapeHTML(s.icone==='❤️'?'selected':'')}>❤️ Curtidas</option>
            <option value="💬" ${escapeHTML(s.icone==='💬'?'selected':'')}>💬 Comentários</option>
            <option value="▶️" ${escapeHTML(s.icone==='▶️'?'selected':'')}>▶️ Visualizações</option>
          </select>
        </td>
        <td style="font-family:monospace;font-size:12px;color:var(--accent);">${escapeHTML(s.idFornecedor)}</td>
        <td><input value="${escapeHTML(s.nomeCustomizado || '')}" data-campo="nomeCustomizado" data-id="${escapeHTML(s.idFornecedor)}"></td>
        <td style="font-size:12px;color:var(--muted);">${escapeHTML(s.categoriaOriginal || '')}</td>
        <td><select data-campo="redeSocial" data-id="${escapeHTML(s.idFornecedor)}" style="margin-bottom:0;padding:6px 8px;font-size:12.5px;">
          <option value="">-- selecione --</option>
          ${redesCadastradas.map(r=>`<option value="${r.nome}" ${escapeHTML(s.redeSocial===r.nome?'selected':'')}>${r.emoji||''} ${r.nome}</option>`).join('')}
        </select></td>
        <td><input value="${escapeHTML(s.servicoTipo || '')}" placeholder="seguidores" data-campo="servicoTipo" data-id="${escapeHTML(s.idFornecedor)}"></td>
        <td>${escapeHTML(s.taxaCusto)}</td>
        <td><input class="small-input" type="number" min="0" step="0.01" placeholder="Global" value="${escapeHTML(s.lucroPercentual ?? '')}" data-campo="lucroPercentual" data-id="${escapeHTML(s.idFornecedor)}" data-custo="${escapeHTML(s.taxaCusto)}"></td>
        <td class="preco-final" data-id="${escapeHTML(s.idFornecedor)}">R$ ${precoFinalInicial}</td>
        <td><button class="secundario btn-salvar-servico" data-id="${escapeHTML(s.idFornecedor)}">Salvar</button></td>
      `);
      tbody.appendChild(tr);
    });

    document.querySelectorAll('input[data-campo="lucroPercentual"]').forEach((input) => {
      input.addEventListener('input', () => {
        const custo = Number(input.dataset.custo);
        const id = input.dataset.id;
        const celula = document.querySelector(`.preco-final[data-id="${id}"]`);
        if(celula) celula.textContent = `R$ ${calcularPrecoFinal(custo, input.value)}`;
      });
    });

    document.querySelectorAll('.btn-salvar-servico').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const linha = btn.closest('tr');
        const campos = {};
        linha.querySelectorAll('[data-campo]').forEach((el) => {
          campos[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
        });
        const r2 = await fetch(`${API_BASE}/api/admin-services`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ idFornecedor: id, ...campos }) });
        btn.textContent = r2.ok ? 'Salvo ✓' : 'Erro';
        setTimeout(() => btn.textContent = 'Salvar', 1500);
      });
    });
  }

  // ===== Pedidos =====
  let todosPedidos = [];

  async function carregarPedidos(){
    const r = await fetch(`${API_BASE}/api/pedidos?`);
    const data = await r.json();
    todosPedidos = data.pedidos || [];
    const clientesCache = {};
    for(const p of todosPedidos){
      if(p.clienteId && !clientesCache[p.clienteId]){
        try{
          const rc = await fetch(`${API_BASE}/api/carteira?&todos=1`);
          const dc = await rc.json();
          (dc.clientes||[]).forEach(c => clientesCache[c.clienteId] = c);
        }catch(e){}
        break;
      }
    }
    renderizarPedidos(todosPedidos, clientesCache);
    window._clientesCache = clientesCache;
  }

  function renderizarPedidos(pedidos, clientesCache){
    const busca = ($('busca-pedido')?.value || '').toLowerCase();
    const lista = busca ? pedidos.filter(p =>
      (p.numeroPedido||'').toLowerCase().includes(busca) ||
      (p.nomeServico||'').toLowerCase().includes(busca) ||
      (p.clienteId||'').includes(busca) ||
      String(p.idFornecedor||'').includes(busca) ||
      ((clientesCache||{})[p.clienteId]?.nome||'').toLowerCase().includes(busca) ||
      ((clientesCache||{})[p.clienteId]?.usuario||'').toLowerCase().includes(busca)
    ) : pedidos;

    const tbody = $('tabela-pedidos-body');
    tbody.innerHTML = safeHTML('');
    lista.forEach((p) => {
      const cli = (clientesCache||{})[p.clienteId];
      const tr = document.createElement('tr');
      tr.innerHTML = safeRowHTML(`
        <td style="color:var(--accent);font-weight:700;">${escapeHTML(p.numeroPedido || '-')}</td>
        <td style="font-size:12px;">
          <div style="font-weight:600;">${escapeHTML(cli?.nome || p.clienteId || '-')}</div>
          ${cli?.usuario ? `<div style="color:var(--muted);font-size:11px;">@${cli.usuario}</div>` : ''}
        </td>
        <td style="font-size:12px;color:var(--muted);">${escapeHTML(p.orderIdFornecedor || '⏳')}</td>
        <td style="font-size:13px;">
          <div>${escapeHTML(p.nomeServico || '-')}</div>
          ${p.idFornecedor ? `<div style="font-size:11px;color:var(--accent);font-family:monospace;margin-top:2px;">cód: ${escapeHTML(p.idFornecedor)}</div>` : ''}
        </td>
        <td style="font-size:11px;max-width:140px;word-break:break-all;">
          <a href="${escapeHTML(p.link||'#')}" target="_blank" style="color:var(--accent);text-decoration:none;" title="${escapeHTML(p.link||'')}">${escapeHTML(p.link ? (p.link.length > 30 ? p.link.slice(0,30)+'...' : p.link) : '-')}</a>
        </td>
        <td>${escapeHTML(p.quantidade)}</td>
        <td>R$ ${escapeHTML(Number(p.valorTotal).toFixed(2))}</td>
        <td><span class="tag ${escapeHTML(p.status === 'concluido' ? 'ativo' : 'inativo')}">${escapeHTML(p.status)}</span></td>
        <td style="font-size:12px;">${escapeHTML(new Date(p.criadoEm).toLocaleString('pt-BR'))}</td>
        <td>${p.status === 'aguardando_pagamento' ? `<button class="secundario btn-confirmar-pgto" data-id="${escapeHTML(p.id)}" style="font-size:12px;padding:6px 10px;">Verificar PIX</button>` : ['enviando','revisao_fornecedor'].includes(p.status) ? `<button class="secundario" data-reconcile="${escapeHTML(p.id)}">Conciliar envio</button>` : ''}</td>
      `);
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-confirmar-pgto').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = 'Confirmando...';
        const r = await fetch('/api/pagamento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verificar',pedidoId:btn.dataset.id})});
        btn.textContent = r.ok ? 'Verificado ✓' : 'Erro';
        if(r.ok) setTimeout(carregarPedidos, 1500);
      });
    });
  }

  $('pedidos-btn').addEventListener('click', carregarPedidos);
  $('busca-pedido')?.addEventListener('input', () => { renderizarPedidos(todosPedidos, window._clientesCache || {}); });

  // ===== Catálogo — estado global dos filtros =====
  const filtrosCatalogo = { estado: '', rede: '', tipo: '', busca: '', ordem: '', pagina: 1 };

  function destacarBtnEstado(){
    document.querySelectorAll('.filtro-estado-btn').forEach(b => {
      b.style.borderColor = b.dataset.estado === filtrosCatalogo.estado ? 'var(--accent)' : '';
      b.style.color = b.dataset.estado === filtrosCatalogo.estado ? 'var(--accent)' : '';
    });
  }

  document.querySelectorAll('.filtro-estado-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtrosCatalogo.estado = btn.dataset.estado;
      filtrosCatalogo.pagina = 1;
      destacarBtnEstado();
      carregarServicos();
    });
  });

  $('btn-limpar-filtros').addEventListener('click', () => {
    filtrosCatalogo.estado = ''; filtrosCatalogo.rede = ''; filtrosCatalogo.tipo = '';
    filtrosCatalogo.busca = ''; filtrosCatalogo.ordem = ''; filtrosCatalogo.pagina = 1;
    $('busca-servico').value = '';
    $('filtro-rede-servico').value = '';
    $('filtro-tipo-servico').value = '';
    $('ordenar-servico').value = '';
    destacarBtnEstado();
    carregarServicos();
  });

  $('filtro-rede-servico').addEventListener('change', () => { filtrosCatalogo.rede = $('filtro-rede-servico').value; filtrosCatalogo.pagina = 1; carregarServicos(); });
  $('filtro-tipo-servico').addEventListener('change', () => { filtrosCatalogo.tipo = $('filtro-tipo-servico').value; filtrosCatalogo.pagina = 1; carregarServicos(); });
  $('ordenar-servico').addEventListener('change', () => { filtrosCatalogo.ordem = $('ordenar-servico').value; filtrosCatalogo.pagina = 1; carregarServicos(); });

  let buscaTimeout;
  $('busca-servico').addEventListener('input', (e) => {
    clearTimeout(buscaTimeout);
    if(e.target.value.length > 0 && e.target.value.length < 2) return;
    buscaTimeout = setTimeout(() => { filtrosCatalogo.busca = e.target.value; filtrosCatalogo.pagina = 1; carregarServicos(); }, 500);
  });

  function renderizarPaginacao(containerId, pagina, totalPaginas){
    const el = $(containerId);
    if(!el || totalPaginas <= 1){ if(el) el.innerHTML = safeHTML(''); return; }
    let html = `<span style="font-size:13px;color:var(--muted);">Página ${pagina} de ${totalPaginas}</span>`;
    if(pagina > 1) html += `<button class="secundario" data-page="${pagina-1}" style="padding:6px 12px;font-size:12px;">← Anterior</button>`;

    // páginas próximas
    const inicio = Math.max(1, pagina - 2);
    const fim = Math.min(totalPaginas, pagina + 2);
    for(let p = inicio; p <= fim; p++){
      html += `<button class="${p===pagina?'':'secundario'}" data-page="${p}" style="padding:6px 10px;font-size:12px;min-width:36px;">${p}</button>`;
    }

    if(pagina < totalPaginas) html += `<button class="secundario" data-page="${pagina+1}" style="padding:6px 12px;font-size:12px;">Próxima →</button>`;
    el.innerHTML = safeHTML(html);
  }

  window.irParaPagina = function(p){ filtrosCatalogo.pagina = p; carregarServicos(); window.scrollTo(0,300); };

  async function carregarServicos(){
    const params = new URLSearchParams({
      pagina: filtrosCatalogo.pagina,
    });
    if(filtrosCatalogo.estado === 'ativos') params.set('somenteAtivos','1');
    if(filtrosCatalogo.estado === 'indisponiveis') params.set('somenteIndisponiveis','1');
    if(filtrosCatalogo.rede) params.set('redeSocial', filtrosCatalogo.rede);
    if(filtrosCatalogo.tipo) params.set('servicoTipo', filtrosCatalogo.tipo);
    if(filtrosCatalogo.busca) params.set('busca', filtrosCatalogo.busca);
    if(filtrosCatalogo.ordem) params.set('ordenar', filtrosCatalogo.ordem);

    let data;
    try {
      const r = await fetch(`${API_BASE}/api/admin-services?${params}`);
      data = await r.json();
      if(!r.ok){ $('servicos-msg').textContent = data.erro || `Erro ${r.status}`; $('servicos-msg').className = 'msg erro'; return; }
    } catch(e) { $('servicos-msg').textContent = 'Falha na busca.'; $('servicos-msg').className = 'msg erro'; return; }

    // popula selects de rede e tipo com opções reais do catálogo
    if(data.redesDisponiveis){
      const redeAtual = $('filtro-rede-servico').value;
      $('filtro-rede-servico').innerHTML = safeHTML('<option value="">Todas as redes</option>' +
        data.redesDisponiveis.map(r=>`<option value="${r}" ${r===redeAtual?'selected':''}>${r}</option>`).join(''));
    }
    if(data.tiposDisponiveis){
      const tipoAtual = $('filtro-tipo-servico').value;
      $('filtro-tipo-servico').innerHTML = safeHTML('<option value="">Todos os tipos</option>' +
        data.tiposDisponiveis.map(t=>`<option value="${t}" ${t===tipoAtual?'selected':''}>${t}</option>`).join(''));
    }

    // mostra última verificação automática
    try{
      const rc = await fetch(`${API_BASE}/api/config?`);
      const dc = await rc.json();
      if(dc.ultimaVerificacaoFornecedor){
        const dt = new Date(dc.ultimaVerificacaoFornecedor).toLocaleString('pt-BR');
        const res = dc.ultimaVerificacaoResultado || {};
        $('ultima-verificacao').textContent = `🕐 Última verificação: ${dt} · ${res.desativados||0} desativados · ${res.reativados||0} reativados`;
      }
    }catch(e){}

    const inicio = (data.pagina - 1) * data.porPagina + 1;
    const fim = Math.min(data.pagina * data.porPagina, data.total);
    $('servicos-msg').textContent = `Mostrando ${inicio}–${fim} de ${data.total} serviços (página ${data.pagina} de ${data.totalPaginas})`;
    $('servicos-msg').className = 'msg';

    renderizarPaginacao('paginacao-topo', data.pagina, data.totalPaginas);
    renderizarPaginacao('paginacao-baixo', data.pagina, data.totalPaginas);

    const tbody = $('tabela-servicos-body');
    tbody.innerHTML = safeHTML('');

    (data.servicos || []).forEach((s) => {
      const tr = document.createElement('tr');
      if(s.indisponivel) tr.style.background = 'rgba(255,80,80,.06)';
      const precoFinalInicial = calcularPrecoFinal(s.taxaCusto, s.lucroPercentual);
      tr.innerHTML = safeRowHTML(`
        <td><input type="checkbox" ${escapeHTML(s.ativo?'checked':'')} data-campo="ativo" data-id="${escapeHTML(s.idFornecedor)}"></td>
        <td>
          <select data-campo="icone" data-id="${escapeHTML(s.idFornecedor)}" style="margin-bottom:0;padding:4px 6px;font-size:13px;">
            <option value="" ${escapeHTML(!s.icone?'selected':'')}>—</option>
            <option value="🇧🇷" ${escapeHTML(s.icone==='🇧🇷'?'selected':'')}>🇧🇷</option>
            <option value="🌍" ${escapeHTML(s.icone==='🌍'?'selected':'')}>🌍</option>
            <option value="🇺🇸" ${escapeHTML(s.icone==='🇺🇸'?'selected':'')}>🇺🇸</option>
            <option value="⭐" ${escapeHTML(s.icone==='⭐'?'selected':'')}>⭐</option>
            <option value="⚡" ${escapeHTML(s.icone==='⚡'?'selected':'')}>⚡</option>
            <option value="🔒" ${escapeHTML(s.icone==='🔒'?'selected':'')}>🔒</option>
            <option value="👥" ${escapeHTML(s.icone==='👥'?'selected':'')}>👥</option>
            <option value="❤️" ${escapeHTML(s.icone==='❤️'?'selected':'')}>❤️</option>
            <option value="💬" ${escapeHTML(s.icone==='💬'?'selected':'')}>💬</option>
            <option value="▶️" ${escapeHTML(s.icone==='▶️'?'selected':'')}>▶️</option>
            <option value="🔥" ${escapeHTML(s.icone==='🔥'?'selected':'')}>🔥</option>
            <option value="💎" ${escapeHTML(s.icone==='💎'?'selected':'')}>💎</option>
            <option value="🚀" ${escapeHTML(s.icone==='🚀'?'selected':'')}>🚀</option>
            <option value="📈" ${escapeHTML(s.icone==='📈'?'selected':'')}>📈</option>
            <option value="🎯" ${escapeHTML(s.icone==='🎯'?'selected':'')}>🎯</option>
            <option value="🎵" ${escapeHTML(s.icone==='🎵'?'selected':'')}>🎵</option>
            <option value="📸" ${escapeHTML(s.icone==='📸'?'selected':'')}>📸</option>
            <option value="🏆" ${escapeHTML(s.icone==='🏆'?'selected':'')}>🏆</option>
          </select>
        </td>
        <td style="font-family:monospace;font-size:12px;color:var(--accent);">${escapeHTML(s.idFornecedor)}</td>
        <td><input value="${escapeHTML(s.nomeCustomizado||'')}" data-campo="nomeCustomizado" data-id="${escapeHTML(s.idFornecedor)}" style="font-family:inherit;" placeholder="Nome (aceita emoji 🇧🇷)"></td>
        <td style="font-size:11px;color:var(--muted);max-width:120px;">${escapeHTML(s.categoriaOriginal||'')}</td>
        <td><select data-campo="redeSocial" data-id="${escapeHTML(s.idFornecedor)}" style="margin-bottom:0;padding:4px 6px;font-size:12px;">
          <option value="">--</option>
          ${redesCadastradas.map(r=>`<option value="${r.nome}" ${escapeHTML(s.redeSocial===r.nome?'selected':'')}>${r.emoji||''} ${r.nome}</option>`).join('')}
        </select></td>
        <td><input value="${escapeHTML(s.servicoTipo||'')}" placeholder="tipo" data-campo="servicoTipo" data-id="${escapeHTML(s.idFornecedor)}" style="font-size:12px;"></td>
        <td style="font-size:12px;">${escapeHTML(s.taxaCusto)}</td>
        <td><input type="number" min="0" step="0.01" placeholder="Global" value="${escapeHTML(s.lucroPercentual??'')}" data-campo="lucroPercentual" data-id="${escapeHTML(s.idFornecedor)}" data-custo="${escapeHTML(s.taxaCusto)}" style="font-size:12px;"></td>
        <td class="preco-final" data-id="${escapeHTML(s.idFornecedor)}" style="font-size:12px;">R$ ${precoFinalInicial}</td>
        <td><button class="secundario btn-salvar-servico" data-id="${escapeHTML(s.idFornecedor)}" style="font-size:12px;padding:6px 10px;">Salvar</button></td>
      `);
      tbody.appendChild(tr);
    });

    document.querySelectorAll('input[data-campo="lucroPercentual"]').forEach((input) => {
      input.addEventListener('input', () => {
        const custo = Number(input.dataset.custo);
        const id = input.dataset.id;
        const celula = document.querySelector(`.preco-final[data-id="${id}"]`);
        if(celula) celula.textContent = `R$ ${calcularPrecoFinal(custo, input.value)}`;
      });
    });

    document.querySelectorAll('.btn-salvar-servico').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const linha = btn.closest('tr');
        const campos = {};
        linha.querySelectorAll('[data-campo]').forEach((el) => {
          campos[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
        });
        const r2 = await fetch(`${API_BASE}/api/admin-services`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ idFornecedor: id, ...campos }) });
        btn.textContent = r2.ok ? 'Salvo ✓' : 'Erro';
        setTimeout(() => btn.textContent = 'Salvar', 1500);
      });
    });
  }

  destacarBtnEstado();
  let redesCadastradas = JSON.parse(localStorage.getItem('admin_redes') || '[]');
  if(redesCadastradas.length === 0){
    redesCadastradas = [{nome:'instagram',emoji:'📸'},{nome:'tiktok',emoji:'🎵'},{nome:'youtube',emoji:'▶️'},{nome:'facebook',emoji:'📘'},{nome:'twitter',emoji:'𝕏'}];
    localStorage.setItem('admin_redes', JSON.stringify(redesCadastradas));
  }
  function salvarRedes(){ localStorage.setItem('admin_redes', JSON.stringify(redesCadastradas)); }
  function renderizarRedes(){
    const lista = $('lista-redes'); if(!lista) return;
    lista.innerHTML = safeHTML(redesCadastradas.map((r,i)=>`
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:5px 12px;">
        <span>${r.emoji||''} ${r.nome}</span>
        <button data-remove-network="${i}" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:0;font-size:14px;">×</button>
      </div>`).join(''));
  }
  window.removerRede = function(i){ redesCadastradas.splice(i,1); salvarRedes(); renderizarRedes(); };
  $('btn-add-rede').addEventListener('click', () => {
    const nome = $('nova-rede-nome').value.trim().toLowerCase();
    const emoji = $('nova-rede-emoji').value.trim();
    if(!nome){ $('redes-msg').textContent='Digite o nome da rede'; return; }
    if(redesCadastradas.find(r=>r.nome===nome)){ $('redes-msg').textContent='Rede já cadastrada'; return; }
    redesCadastradas.push({nome,emoji}); salvarRedes(); renderizarRedes();
    $('nova-rede-nome').value=''; $('nova-rede-emoji').value='';
    $('redes-msg').textContent='✅ Rede adicionada!'; setTimeout(()=>$('redes-msg').textContent='',2000);
  });
  renderizarRedes();

  // ===== Abas =====
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('ativa'));
      document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('visivel'));
      btn.classList.add('ativa');
      $('tab-'+btn.dataset.tab).classList.add('visivel');
    });
  });

  // ===== Integrações =====
  async function carregarIntegracoes(){
    const r = await fetch(`${API_BASE}/api/config?`);
    const data = await r.json();
    $('mp-appurl').value = data.appUrl || '';
    const mpOk = data.mpConfigurado;
    $('mp-status-msg').textContent = mpOk ? '✅ Mercado Pago configurado' : '⚠️ Mercado Pago não configurado ainda';
    $('mp-status-msg').className = 'msg '+(mpOk?'ok':'erro');
    if(data.appUrl){
      $('mp-webhook-url').textContent = `${data.appUrl}/api/pagamento?action=webhook`;
      $('mp-webhook-carteira').textContent = `${data.appUrl}/api/pagamento?action=webhook`;
    }
  }
  $('mp-salvar').addEventListener('click', async () => {
    const body = { mpAccessToken: $('mp-token').value, appUrl: $('mp-appurl').value };
    const r = await fetch(`${API_BASE}/api/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await r.json();
    $('mp-msg').textContent = r.ok ? 'Configuração do MP salva.' : (data.erro||'Erro');
    $('mp-msg').className = 'msg '+(r.ok?'ok':'erro');
    if(r.ok) carregarIntegracoes();
  });
  $('mp-appurl').addEventListener('input', () => {
    const url = $('mp-appurl').value.replace(/\/$/,'');
    if(url){ $('mp-webhook-url').textContent=`${url}/api/pagamento?action=webhook`; $('mp-webhook-carteira').textContent=`${url}/api/carteira?action=webhook`; }
  });

  // ===== Tickets =====
  async function carregarTickets(){
    const r = await fetch(`${API_BASE}/api/tickets?`);
    const data = await r.json();
    const tbody = $('tabela-tickets-body');
    tbody.innerHTML = safeHTML('');
    (data.tickets||[]).forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = safeRowHTML(`
        <td>${escapeHTML(t.nome||'')}</td><td>${escapeHTML(t.whatsapp||t.clienteId||'')}</td>
        <td style="max-width:200px;">${escapeHTML(t.mensagem||'')}</td>
        <td>${escapeHTML(t.pedidoId?t.pedidoId.slice(-6):'-')}</td>
        <td><span class="tag ${escapeHTML(t.status==='resolvido'?'ativo':'inativo')}">${escapeHTML(t.status)}</span></td>
        <td style="min-width:180px;">
          <input value="${escapeHTML(t.resposta||'')}" data-resposta="${escapeHTML(t.id)}" placeholder="Resposta..." style="margin-bottom:6px;">
          <div style="display:flex;gap:6px;">
            <button class="secundario btn-responder-ticket" data-id="${escapeHTML(t.id)}" style="flex:1;font-size:12px;padding:6px;">💬 Responder</button>
            <button class="secundario btn-resolver-ticket" data-id="${escapeHTML(t.id)}" style="flex:1;font-size:12px;padding:6px;">${escapeHTML(t.status==='resolvido'?'🔄 Reabrir':'✅ Resolver')}</button>
          </div>
        </td>`);
      tbody.appendChild(tr);
    });
    document.querySelectorAll('.btn-responder-ticket').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const inp = document.querySelector(`[data-resposta="${id}"]`);
        if(!inp.value.trim()){ btn.textContent='Digite algo!'; setTimeout(()=>btn.textContent='💬 Responder',1500); return; }
        btn.disabled=true;
        const r2 = await fetch(`${API_BASE}/api/tickets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,resposta:inp.value})});
        btn.textContent=r2.ok?'Enviado ✓':'Erro'; btn.disabled=false;
        setTimeout(()=>btn.textContent='💬 Responder',1500);
      });
    });
    document.querySelectorAll('.btn-resolver-ticket').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const inp = document.querySelector(`[data-resposta="${id}"]`);
        const t = (data.tickets||[]).find(t=>t.id===id);
        const novoStatus = t.status==='resolvido'?'aberto':'resolvido';
        await fetch(`${API_BASE}/api/tickets`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:id,status:novoStatus,resposta:inp.value})});
        carregarTickets();
      });
    });
  }
  $('tickets-btn').addEventListener('click', carregarTickets);

  // ===== Clientes =====
  let todosClientes = [];
  async function carregarClientes(){
    $('clientes-msg').textContent='Carregando...';
    const r = await fetch(`${API_BASE}/api/carteira?&todos=1`);
    const data = await r.json();
    todosClientes = data.clientes||[];
    $('clientes-msg').textContent='';
    renderizarClientes();
  }

  function origemEmoji(origem){
    const mapa={google:'🔎 Google',youtube:'▶️ YouTube',instagram:'📸 Instagram',facebook:'📘 Facebook',tiktok:'🎵 TikTok',indicacao:'👥 Indicação',outros:'💬 Outros',nao_informado:'-'};
    return mapa[origem]||origem||'-';
  }

  function renderizarClientes(){
    const busca=($('busca-cliente').value||'').toLowerCase();
    const filtroSaldo=$('filtro-saldo').value;
    let lista=todosClientes.filter(c=>{
      if(busca){ const match=(c.nome||'').toLowerCase().includes(busca)||(c.usuario||'').toLowerCase().includes(busca)||(c.whatsapp||'').includes(busca); if(!match) return false; }
      if(filtroSaldo==='com'&&Number(c.saldo||0)<=0) return false;
      if(filtroSaldo==='sem'&&Number(c.saldo||0)>0) return false;
      return true;
    });
    $('clientes-total-msg').textContent=`${lista.length} cliente(s) de ${todosClientes.length} total.`;
    const tbody=$('tabela-clientes-body'); tbody.innerHTML=safeHTML('');
    lista.forEach((c)=>{
      const tr=document.createElement('tr');
      tr.innerHTML = safeRowHTML(`
        <td>${escapeHTML(c.nome||'-')}</td>
        <td style="color:var(--accent);">${escapeHTML(c.usuario?'@'+c.usuario:'-')}</td>
        <td>${escapeHTML(c.whatsapp&&c.whatsapp!=='undefined'?c.whatsapp:c.clienteId)}</td>
        <td style="font-size:12px;">${escapeHTML(origemEmoji(c.origem))}</td>
        <td style="color:${escapeHTML(Number(c.saldo||0)>0?'var(--accent)':'var(--muted)')};font-weight:700;">R$ ${escapeHTML(Number(c.saldo||0).toFixed(2))}</td>
        <td style="font-size:12px;color:var(--muted);">${escapeHTML(c.ultimoCredito?new Date(c.ultimoCredito).toLocaleDateString('pt-BR'):'-')}</td>
        <td style="font-size:12px;color:var(--muted);">${escapeHTML(c.criadoEm?new Date(c.criadoEm).toLocaleDateString('pt-BR'):'-')}</td>
        <td><div style="display:flex;gap:6px;align-items:center;">
          <input type="number" min="0" max="90" placeholder="%" style="width:60px;margin-bottom:0;padding:6px 8px;font-size:12px;" data-desconto="${escapeHTML(c.whatsapp||c.clienteId)}" value="${escapeHTML(c.desconto||0)}">
          <button class="secundario btn-desconto" data-id="${escapeHTML(c.whatsapp||c.clienteId)}" style="font-size:12px;padding:6px 8px;">%</button>
        </div></td>
        <td><div style="display:flex;gap:6px;align-items:center;">
          <input type="number" min="0.01" step="0.01" placeholder="R$" style="width:80px;margin-bottom:0;padding:6px 8px;font-size:12px;" data-creditar="${escapeHTML(c.whatsapp||c.clienteId)}">
          <button class="secundario btn-creditar" data-id="${escapeHTML(c.whatsapp||c.clienteId)}" style="font-size:12px;padding:6px 10px;">💰</button>
        </div></td>
        <td><button class="secundario btn-historico" data-id="${escapeHTML(c.whatsapp||c.clienteId)}" data-nome="${escapeHTML(c.nome||c.clienteId)}" style="font-size:12px;padding:6px 10px;">📋 Histórico</button></td>
      `);
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-desconto').forEach((btn)=>{
      btn.addEventListener('click', async()=>{
        const id=btn.dataset.id; const input=document.querySelector(`[data-desconto="${id}"]`); const desconto=Number(input.value);
        if(isNaN(desconto)||desconto<0||desconto>90){btn.textContent='!';setTimeout(()=>btn.textContent='%',1500);return;}
        btn.disabled=true;
        const r=await fetch(`${API_BASE}/api/auth-cliente`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'set-desconto',clienteId:id,desconto})});
        btn.textContent=r.ok?'✓':'✗'; btn.disabled=false; setTimeout(()=>btn.textContent='%',1500);
      });
    });

    document.querySelectorAll('.btn-creditar').forEach((btn)=>{
      btn.addEventListener('click', async()=>{
        const id=btn.dataset.id; const input=document.querySelector(`[data-creditar="${id}"]`); const valor=Number(input.value);
        if(!valor||valor<=0){btn.textContent='!';setTimeout(()=>btn.textContent='💰',1500);return;}
        btn.disabled=true;
        const r=await fetch(`${API_BASE}/api/carteira`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId:id,valor,creditar:true})});
        const data=await r.json(); btn.textContent=r.ok?'✓':'✗'; btn.disabled=false; input.value='';
        setTimeout(()=>{btn.textContent='💰'; carregarClientes();},1500);
      });
    });
  }

  $('busca-cliente').addEventListener('input', renderizarClientes);
  $('filtro-saldo').addEventListener('change', renderizarClientes);
  $('clientes-btn').addEventListener('click', carregarClientes);

  $('creditar-manual-btn').addEventListener('click', async()=>{
    const clienteId=$('creditar-id').value.replace(/\D/g,''); const valor=Number($('creditar-valor').value);
    if(!clienteId){$('creditar-msg').textContent='Informe o WhatsApp';$('creditar-msg').className='msg erro';return;}
    if(!valor||valor<=0){$('creditar-msg').textContent='Informe um valor válido';$('creditar-msg').className='msg erro';return;}
    $('creditar-manual-btn').disabled=true; $('creditar-msg').textContent='Creditando...';
    const r=await fetch(`${API_BASE}/api/carteira`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId,valor,creditar:true})});
    const data=await r.json();
    if(r.ok){$('creditar-msg').textContent=`✅ R$ ${valor.toFixed(2)} creditado! Novo saldo: R$ ${Number(data.novoSaldo).toFixed(2)}`;$('creditar-msg').className='msg ok';$('creditar-id').value='';$('creditar-valor').value='';carregarClientes();}
    else{$('creditar-msg').textContent=data.erro||'Erro';$('creditar-msg').className='msg erro';}
    $('creditar-manual-btn').disabled=false;
  });

  function atualizarPrecosServicos(){
    document.querySelectorAll('input[data-campo="lucroPercentual"]').forEach(input=>{
      const cell=input.closest('tr').querySelector('.preco-final');
      if(cell) cell.textContent='R$ '+calcularPrecoFinal(input.dataset.custo,input.value);
    });
  }
  function calcularPrecoFinal(custo, lucroPercentual){
    const lucro=(lucroPercentual===''||lucroPercentual===null||lucroPercentual===undefined)?lucroGlobalAtual:Number(lucroPercentual);
    const custoConvertido=Number(custo)*(cotacaoAtual||1);
    return (Math.round(custoConvertido*(1+lucro/100)*100)/100).toFixed(2);
  }


  // ===== Vitrine =====
  async function carregarVitrine(){
    const r = await fetch(`${API_BASE}/api/config?action=vitrine-admin`);
    const data = await r.json();
    const lista = $('vitrine-lista');
    lista.innerHTML = safeHTML('');
    if(!data.produtos || data.produtos.length === 0){
      lista.innerHTML = safeHTML('<p style="color:var(--muted);font-size:13px;">Nenhum produto cadastrado ainda.</p>');
      return;
    }
    data.produtos.forEach(p => {
      const card = document.createElement('div');
      card.style.cssText = `background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;`;
      card.innerHTML = safeHTML(`
        ${p.imagemUrl ? `<img src="${escapeHTML(p.imagemUrl)}" style="width:100%;height:160px;object-fit:cover;">` : `<div style="width:100%;height:100px;background:#1a1f25;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">Sem imagem (800×400px)</div>`}
        <div style="padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <strong style="font-size:14px;">${escapeHTML(p.nome||'Sem nome')}</strong>
            <span style="color:var(--accent);font-weight:700;font-size:14px;">${escapeHTML(p.preco||'')}</span>
          </div>
          <p style="font-size:12.5px;color:var(--muted);margin:0 0 10px;">${escapeHTML(p.descricao||'')}</p>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="tag ${escapeHTML(p.ativo?'ativo':'inativo')}">${escapeHTML(p.ativo?'Ativo':'Inativo')}</span>
            <button class="secundario" data-edit-product="${escapeHTML(p.id)}" style="font-size:12px;padding:4px 10px;">✏️ Editar</button>
            <button class="secundario" data-remove-product="${escapeHTML(p.id)}" style="font-size:12px;padding:4px 10px;color:#ff8b8b;">🗑️</button>
          </div>
        </div>
      `);
      lista.appendChild(card);
    });
    window._vitrineData = data.produtos;
  }

  window.editarProduto = function(id){
    const p = (window._vitrineData||[]).find(x=>x.id===id);
    if(!p) return;
    $('vitrine-edit-id').value = p.id;
    $('vitrine-nome').value = p.nome||'';
    $('vitrine-preco').value = p.preco||'';
    $('vitrine-desc').value = p.descricao||'';
    $('vitrine-img').value = p.imagemUrl||'';
    $('vitrine-link').value = p.linkContato||'';
    $('vitrine-ordem').value = p.ordem||0;
    $('vitrine-ativo').checked = p.ativo !== false;
    $('vitrine-nome').focus();
    // scroll pro formulário
    $('tab-vitrine').scrollIntoView({behavior:'smooth'});
  };

  window.removerProduto = async function(id){
    if(!confirm('Remover este produto da vitrine?')) return;
    const r = await fetch(`${API_BASE}/api/config`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'vitrine-remover', id })
    });
    if(r.ok){ carregarVitrine(); }
  };

  $('vitrine-salvar-btn').addEventListener('click', async () => {
    const nome = $('vitrine-nome').value.trim();
    if(!nome){ $('vitrine-msg').textContent='Informe o nome do produto'; $('vitrine-msg').className='msg erro'; return; }
    $('vitrine-salvar-btn').disabled = true;
    const body = {
      action: 'vitrine-salvar',
      id: $('vitrine-edit-id').value || null,
      nome, preco: $('vitrine-preco').value,
      descricao: $('vitrine-desc').value,
      imagemUrl: $('vitrine-img').value,
      linkContato: $('vitrine-link').value,
      ordem: Number($('vitrine-ordem').value||0),
      ativo: $('vitrine-ativo').checked,
    };
    const r = await fetch(`${API_BASE}/api/config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await r.json();
    if(r.ok){
      $('vitrine-msg').textContent = '✅ Produto salvo!'; $('vitrine-msg').className = 'msg ok';
      $('vitrine-edit-id').value = '';
      $('vitrine-nome').value=''; $('vitrine-preco').value=''; $('vitrine-desc').value='';
      $('vitrine-img').value=''; $('vitrine-link').value=''; $('vitrine-ordem').value='';
      $('vitrine-ativo').checked = true;
      carregarVitrine();
    } else {
      $('vitrine-msg').textContent = data.erro||'Erro'; $('vitrine-msg').className = 'msg erro';
    }
    $('vitrine-salvar-btn').disabled = false;
  });

  $('vitrine-limpar-btn').addEventListener('click', () => {
    $('vitrine-edit-id').value=''; $('vitrine-nome').value=''; $('vitrine-preco').value='';
    $('vitrine-desc').value=''; $('vitrine-img').value=''; $('vitrine-link').value='';
    $('vitrine-ordem').value=''; $('vitrine-ativo').checked=true; $('vitrine-msg').textContent='';
  });

  $('vitrine-listar-btn').addEventListener('click', carregarVitrine);

  // ===== Histórico do cliente =====
  async function abrirHistorico(clienteId, nomeCliente){
    $('modal-cliente-nome').textContent=nomeCliente;
    $('modal-historico').style.display='block';
    $('modal-pedidos-lista').innerHTML=safeHTML('<p style="color:var(--muted);font-size:13px;">Carregando...</p>');
    $('modal-recargas-lista').innerHTML=safeHTML('<p style="color:var(--muted);font-size:13px;">Carregando...</p>');
    try{
      const r=await fetch(`${API_BASE}/api/pedidos?clienteId=${encodeURIComponent(clienteId)}`);
      const data=await r.json(); const pedidos=data.pedidos||[];
      const totalGasto=pedidos.reduce((s,p)=>s+Number(p.valorTotal||0),0);
      $('modal-total-pedidos').textContent=pedidos.length;
      $('modal-total-gasto').textContent=`R$ ${totalGasto.toFixed(2)}`;
      $('modal-pedidos-lista').innerHTML=safeHTML(pedidos.length===0
        ?'<p style="color:var(--muted);font-size:13px;">Nenhum pedido.</p>'
        :pedidos.map(p=>`
          <div style="border-bottom:1px solid var(--line);padding:8px 0;display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <span style="color:var(--accent);font-weight:700;font-size:12px;">${escapeHTML(p.numeroPedido||'-')}</span>
              <span style="font-size:13px;margin-left:8px;">${escapeHTML(p.nomeServico||'-')}</span>
              ${p.idFornecedor?`<span style="font-size:11px;color:var(--accent);font-family:monospace;margin-left:6px;">(cód: ${escapeHTML(p.idFornecedor)})</span>`:''}
              ${p.link?`<div style="font-size:11px;margin-top:3px;"><a href="${escapeHTML(p.link)}" target="_blank" style="color:var(--muted);text-decoration:none;">🔗 ${escapeHTML(p.link.length>50?p.link.slice(0,50)+'...':p.link)}</a></div>`:''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:700;">R$ ${escapeHTML(Number(p.valorTotal).toFixed(2))}</div>
              <div style="font-size:11px;color:var(--muted);">${escapeHTML(p.status)} · ${escapeHTML(new Date(p.criadoEm).toLocaleDateString('pt-BR'))}</div>
            </div>
          </div>`).join(''));
    }catch(e){ $('modal-pedidos-lista').innerHTML=safeHTML('<p style="color:#ff8b8b;font-size:13px;">Erro ao carregar pedidos.</p>'); }
    try{
      const r2=await fetch(`/api/carteira?action=historico&clienteId=${encodeURIComponent(clienteId)}`);
      const deps=(await r2.json()).depositos||{};
      const minhasRecargas=Object.entries(deps).filter(([,d])=>d&&d.clienteId===clienteId).sort(([,a],[,b])=>b.criadoEm-a.criadoEm);
      const r3=await fetch(`${API_BASE}/api/carteira?clienteId=${encodeURIComponent(clienteId)}`);
      const saldoData=await r3.json();
      $('modal-saldo-atual').textContent=`R$ ${Number(saldoData.saldo||0).toFixed(2)}`;
      $('modal-recargas-lista').innerHTML=safeHTML(minhasRecargas.length===0
        ?'<p style="color:var(--muted);font-size:13px;">Nenhuma recarga via PIX registrada.</p>'
        :minhasRecargas.map(([id,d])=>`
          <div style="border-bottom:1px solid var(--line);padding:8px 0;display:flex;justify-content:space-between;">
            <div style="font-size:13px;">💰 Recarga PIX</div>
            <div style="text-align:right;">
              <div style="font-weight:700;color:var(--accent);">+ R$ ${Number(d.valor||0).toFixed(2)}</div>
              <div style="font-size:11px;color:var(--muted);">${d.status} · ${new Date(d.criadoEm).toLocaleDateString('pt-BR')}</div>
            </div>
          </div>`).join(''));
    }catch(e){ $('modal-recargas-lista').innerHTML=safeHTML('<p style="color:#ff8b8b;font-size:13px;">Erro ao carregar recargas.</p>'); }
  }

  document.addEventListener('click', e=>{
    const btn=e.target.closest('.btn-historico');
    if(btn) abrirHistorico(btn.dataset.id, btn.dataset.nome);
  });

  async function carregarRevendedores(){
    const r=await fetch('/api/revendedor?todos=1'); const d=await r.json();
    const tbody=$('tabela-revendedores'); tbody.replaceChildren();
    for(const c of d.revendedores||[]){
      const tr=document.createElement('tr');
      for(const value of [c.nome,c.usuario,c.whatsapp,c.desconto+'%',Number(c.saldo).toFixed(2)]) { const td=document.createElement('td'); td.textContent=value; tr.append(td); }
      const credit=document.createElement('td'), cb=document.createElement('button'); cb.textContent='Creditar';
      cb.addEventListener('click',async()=>{ const valor=prompt('Valor a creditar (R$):'); if(valor===null)return; const r=await fetch('/api/carteira',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clienteId:c.clienteId,valor,creditar:true})}); if(!r.ok)alert((await r.json()).erro); await carregarRevendedores(); }); credit.append(cb);tr.append(credit);
      const discount=document.createElement('td'), db=document.createElement('button');db.textContent='Alterar desconto';
      db.addEventListener('click',async()=>{const desconto=prompt('Desconto de 0 a 90%:',c.desconto);if(desconto===null)return;const r=await fetch('/api/revendedor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao:'set-desconto',clienteId:c.clienteId,desconto})});if(!r.ok)alert((await r.json()).erro);await carregarRevendedores();});discount.append(db);tr.append(discount);tbody.append(tr);
    }
  }
  $('rev-listar-btn').addEventListener('click',()=>carregarRevendedores().catch(()=>{}));
  $('rev-criar-btn').addEventListener('click',async()=>{
    const btn=$('rev-criar-btn');btn.disabled=true;
    try {const r=await fetch('/api/revendedor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:$('rev-nome').value,usuario:$('rev-usuario').value,whatsapp:$('rev-whats').value,senha:$('rev-senha').value,desconto:$('rev-desconto').value||0})});const d=await r.json();$('rev-criar-msg').textContent=r.ok?'Revendedor criado':d.erro;if(r.ok){$('rev-senha').value='';await carregarRevendedores();}}catch{$('rev-criar-msg').textContent='Erro de conexão';}finally{btn.disabled=false;}
  });

  document.addEventListener('click', async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-close-history'))$('modal-historico').style.display='none';
    if(b.dataset.reconcile){
      const orderIdFornecedor=prompt('Se o pedido existe no fornecedor, informe o ID. Se confirmou que não foi criado, deixe vazio para estornar. Cancelar mantém em conferência.');if(orderIdFornecedor===null)return;
      const justificativa=prompt('Registre o que verificou no fornecedor:');if(!justificativa)return;
      const action=orderIdFornecedor?'vincular-fornecedor':'confirmar-nao-enviado';
      if(!orderIdFornecedor&&!confirm('Confirma que verificou no fornecedor e o pedido NÃO foi criado? O pagamento será estornado.'))return;
      b.disabled=true;try{const r=await fetch('/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,pedidoId:b.dataset.reconcile,orderIdFornecedor,justificativa})});if(!r.ok)alert((await r.json()).erro);await carregarPedidos();}finally{b.disabled=false;}
    }

    if(b.dataset.page!==undefined)window.irParaPagina(Number(b.dataset.page));
    if(b.dataset.removeNetwork!==undefined)window.removerRede(Number(b.dataset.removeNetwork));
    if(b.dataset.editProduct)window.editarProduto(b.dataset.editProduct);
    if(b.dataset.removeProduct)window.removerProduto(b.dataset.removeProduct);
  });
})();
