// api/public-api.js
// API pública do painel Fênix Social.
// Autenticação via header: Authorization: Bearer fsx_CHAVE
// ou query param: ?key=fsx_CHAVE
//
// Endpoints:
//   GET  ?action=services                    -> lista serviços disponíveis
//   GET  ?action=balance                     -> saldo da conta
//   GET  ?action=status&order=ID             -> status de um pedido
//   POST { action:'add', service, link, quantity } -> criar pedido

const { fbGet, fbPatch, fbPost } = require('../lib/firebase');
const { criarPedido } = require('../lib/fornecedor');

async function autenticar(req) {
  // pega a chave do header ou query
  const authHeader = req.headers['authorization'] || '';
  const keyHeader = authHeader.replace('Bearer ', '').trim();
  const keyQuery = req.query?.key || req.body?.key || '';
  const key = keyHeader || keyQuery;

  if (!key || !key.startsWith('fsx_')) {
    return { erro: 'Chave de API inválida. Use o header Authorization: Bearer fsx_SUA_CHAVE', status: 401 };
  }

  // busca o cliente dono dessa chave
  const indice = await fbGet(`api_keys/${key}`).catch(() => null);
  if (!indice || !indice.clienteId) {
    return { erro: 'Chave de API não encontrada ou inativa', status: 401 };
  }

  const cliente = await fbGet(`clientes/${indice.clienteId}`).catch(() => null);
  if (!cliente) {
    return { erro: 'Conta associada à chave não encontrada', status: 401 };
  }

  return { clienteId: indice.clienteId, cliente };
}

function calcularPreco(servico, lucroGlobal, cotacao, descontoCliente) {
  const lucroPct = servico.lucroPercentual ?? lucroGlobal ?? 30;
  const custoPorMil = servico.taxaCusto * (cotacao || 1);
  let precoPorMil = custoPorMil * (1 + lucroPct / 100);
  if (descontoCliente > 0) {
    precoPorMil = precoPorMil * (1 - descontoCliente / 100);
  }
  return Math.round(precoPorMil * 100) / 100;
}

module.exports = async (req, res) => {
  // CORS pra permitir chamadas de qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action;

  if (!action) {
    return res.status(200).json({
      api: 'Fênix Social API',
      versao: '1.0',
      docs: 'https://fenixsocial.site/api-docs.html',
      actions: ['services', 'balance', 'status', 'add'],
    });
  }

  // autentica
  const auth = await autenticar(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });
  const { clienteId, cliente } = auth;

  try {
    // ===== SERVICES =====
    if (action === 'services') {
      const [catalogo, config] = await Promise.all([fbGet('catalogo'), fbGet('config')]);
      const lucroGlobal = config?.lucroPercentualGlobal ?? 30;
      const cotacao = config?.cotacaoUSDBRL || null;
      const descontoCliente = Number(cliente.desconto || 0);

      const ativos = Object.values(catalogo || {})
        .filter(s => s && s.ativo)
        .map(s => ({
          service: s.idFornecedor,
          name: s.nomeCustomizado || s.nomeOriginal,
          category: s.categoriaOriginal || '',
          type: s.servicoTipo || '',
          rate: calcularPreco(s, lucroGlobal, cotacao, descontoCliente),
          min: s.min,
          max: s.max,
          refill: s.refill || false,
        }));

      return res.status(200).json(ativos);
    }

    // ===== BALANCE =====
    if (action === 'balance') {
      const carteira = await fbGet(`carteiras/${clienteId}`).catch(() => null);
      return res.status(200).json({
        balance: Number(carteira?.saldo || 0).toFixed(2),
        currency: 'BRL',
      });
    }

    // ===== STATUS =====
    if (action === 'status') {
      const orderId = req.query?.order || req.body?.order;
      if (!orderId) return res.status(400).json({ error: 'order é obrigatório' });

      // busca o pedido pelo numeroPedido ou pelo ID interno
      const pedidos = await fbGet('pedidos').catch(() => ({}));
      const entrada = Object.entries(pedidos || {}).find(
        ([id, p]) => p && (p.numeroPedido === orderId || id === orderId) && p.clienteId === clienteId
      );

      if (!entrada) return res.status(404).json({ error: 'Pedido não encontrado' });
      const [, pedido] = entrada;

      return res.status(200).json({
        order: pedido.numeroPedido || orderId,
        status: pedido.status,
        charge: Number(pedido.valorTotal || 0).toFixed(2),
        start_count: pedido.startCount || 0,
        remains: pedido.restam || 0,
        currency: 'BRL',
      });
    }

    // ===== ADD ORDER =====
    if (action === 'add') {
      const service = req.body?.service;
      const link = req.body?.link;
      const quantity = Number(req.body?.quantity || 0);
      const comments = req.body?.comments || null;

      if (!service || !link || !quantity) {
        return res.status(400).json({ error: 'service, link e quantity são obrigatórios' });
      }

      const [catalogo, config] = await Promise.all([fbGet('catalogo'), fbGet('config')]);
      const servico = catalogo?.[service];

      if (!servico || !servico.ativo) {
        return res.status(404).json({ error: 'Serviço não disponível' });
      }

      if (quantity < servico.min || quantity > servico.max) {
        return res.status(400).json({ error: `Quantidade deve estar entre ${servico.min} e ${servico.max}` });
      }

      const lucroGlobal = config?.lucroPercentualGlobal ?? 30;
      const cotacao = config?.cotacaoUSDBRL || null;
      const descontoCliente = Number(cliente.desconto || 0);
      const precoPorMil = calcularPreco(servico, lucroGlobal, cotacao, descontoCliente);
      const valorTotal = Math.round((precoPorMil * quantity / 1000) * 100) / 100;

      // verifica saldo
      const carteira = await fbGet(`carteiras/${clienteId}`).catch(() => null);
      const saldo = Number(carteira?.saldo || 0);

      if (saldo < valorTotal) {
        return res.status(400).json({
          error: `Saldo insuficiente. Disponível: R$ ${saldo.toFixed(2)}. Necessário: R$ ${valorTotal.toFixed(2)}`,
        });
      }

      // gera número do pedido
      const contador = (await fbGet('config/contadorPedidos').catch(() => null)) || 0;
      const novoContador = Number(contador) + 1;
      await fbPatch('config', { contadorPedidos: novoContador });
      const numeroPedido = '#' + String(novoContador).padStart(5, '0');

      // cria pedido
      const pedido = {
        numeroPedido,
        idFornecedor: service,
        nomeServico: servico.nomeCustomizado || servico.nomeOriginal,
        link,
        quantidade: quantity,
        valorTotal,
        status: 'processando_saldo',
        clienteId,
        pagamento: 'saldo',
        viaApi: true,
        criadoEm: Date.now(),
      };

      const novo = await fbPost('pedidos', pedido);
      const pedidoId = novo.name;

      // debita saldo
      const novoSaldo = Math.round((saldo - valorTotal) * 100) / 100;
      await fbPatch(`carteiras/${clienteId}`, { saldo: novoSaldo });

      // envia pro fornecedor
      let orderIdFornecedor = null;
      try {
        const resposta = await criarPedido({ service, link, quantity, ...(comments ? { comments } : {}) });
        orderIdFornecedor = resposta.pedido || resposta.order;
      } catch (e) {}

      await fbPatch(`pedidos/${pedidoId}`, {
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        orderIdFornecedor: orderIdFornecedor || null,
        pagoEm: Date.now(),
      });

      return res.status(200).json({
        order: numeroPedido,
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        charge: valorTotal.toFixed(2),
        currency: 'BRL',
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
