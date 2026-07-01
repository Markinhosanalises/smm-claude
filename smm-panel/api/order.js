// api/order.js
const { fbGet, fbPost, fbPatch } = require('../lib/firebase');
const { criarPedido } = require('../lib/fornecedor');

function calcularPreco(servico, lucroGlobal, cotacao) {
  const lucroPct = servico.lucroPercentual ?? lucroGlobal ?? 30;
  const custoPorMil = servico.taxaCusto * (cotacao || 1);
  const precoPorMil = custoPorMil * (1 + lucroPct / 100);
  return Math.round(precoPorMil * 100) / 100;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { idFornecedor, link, quantidade, clienteId, clienteContato, pagarComSaldo, comments } = req.body || {};

    if (!idFornecedor || !link || !quantidade) {
      return res.status(400).json({ erro: 'idFornecedor, link e quantidade são obrigatórios' });
    }

    const [catalogo, config] = await Promise.all([fbGet('catalogo'), fbGet('config')]);
    const servico = catalogo?.[idFornecedor];

    if (!servico || !servico.ativo) {
      return res.status(404).json({ erro: 'Serviço indisponível' });
    }

    const qtd = Number(quantidade);
    if (qtd < servico.min || qtd > servico.max) {
      return res.status(400).json({ erro: `Quantidade deve estar entre ${servico.min} e ${servico.max}` });
    }

    const lucroGlobal = config?.lucroPercentualGlobal ?? 30;
    const cotacao = config?.cotacaoUSDBRL || null;
    const precoPorMil = calcularPreco(servico, lucroGlobal, cotacao);
    const valorTotal = Math.round((precoPorMil * qtd / 1000) * 100) / 100;

    // pagar com saldo da carteira
    if (pagarComSaldo && clienteId) {
      const carteira = (await fbGet(`carteiras/${clienteId}`)) || { saldo: 0 };
      const saldoAtual = Number(carteira.saldo || 0);

      if (saldoAtual < valorTotal) {
        return res.status(400).json({
          erro: `Saldo insuficiente. Seu saldo: R$ ${saldoAtual.toFixed(2)}. Necessário: R$ ${valorTotal.toFixed(2)}`,
          saldoAtual,
          valorTotal,
        });
      }

      // 1. Cria o pedido primeiro com status executando
      const pedido = {
        idFornecedor,
        nomeServico: servico.nomeCustomizado || servico.nomeOriginal,
        link,
        quantidade: qtd,
        valorTotal,
        status: 'processando_saldo',
        clienteId: clienteId || null,
        pagamento: 'saldo',
        criadoEm: Date.now(),
      };
      const novo = await fbPost('pedidos', pedido);
      const pedidoId = novo.name;

      // 2. Debita o saldo no Firebase
      const novoSaldo = Math.round((saldoAtual - valorTotal) * 100) / 100;
      await fbPatch(`carteiras/${clienteId}`, { saldo: novoSaldo });

      // 3. Envia pro fornecedor
      let orderIdFornecedor = null;
      let erroFornecedor = null;
      try {
        const resposta = await criarPedido({
          service: idFornecedor,
          link,
          quantity: qtd,
          ...(comments ? { comments } : {}),
        });
        orderIdFornecedor = resposta.pedido || resposta.order;
        if (!orderIdFornecedor) erroFornecedor = resposta;
      } catch (errFornecedor) {
        erroFornecedor = { message: errFornecedor.message };
      }

      // 4. Atualiza o status do pedido
      await fbPatch(`pedidos/${pedidoId}`, {
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        orderIdFornecedor: orderIdFornecedor || null,
        erroFornecedor: erroFornecedor || null,
        pagoEm: Date.now(),
      });

      return res.status(200).json({
        pedidoId,
        ...pedido,
        status: orderIdFornecedor ? 'executando' : 'erro_fornecedor',
        orderIdFornecedor,
        novoSaldo,
        pagamento: 'saldo',
      });
    }

    // pagamento via PIX (fluxo normal)
    const pedido = {
      idFornecedor,
      nomeServico: servico.nomeCustomizado || servico.nomeOriginal,
      link,
      quantidade: qtd,
      valorTotal,
      status: 'aguardando_pagamento',
      clienteId: clienteId || null,
      clienteContato: clienteContato || null,
      pagamento: 'pix',
      comments: comments || null,
      criadoEm: Date.now(),
    };

    const novo = await fbPost('pedidos', pedido);

    return res.status(200).json({ pedidoId: novo.name, ...pedido });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
