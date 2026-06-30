// api/order.js
// Cliente cria um pedido. Nesse momento o pedido SÓ é salvo no Firebase
// com status "aguardando_pagamento" — ainda não é enviado pro fornecedor.
// O envio real pro fornecedor só acontece em /api/confirm-payment, depois
// que o pagamento for confirmado (evita pagar o fornecedor por algo que
// o cliente não pagou pra você).

const { fbGet, fbPost } = require('../lib/firebase');

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
    const { idFornecedor, link, quantidade, clienteId, clienteContato } = req.body || {};

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

    const pedido = {
      idFornecedor,
      nomeServico: servico.nomeCustomizado || servico.nomeOriginal,
      link,
      quantidade: qtd,
      valorTotal,
      status: 'aguardando_pagamento',
      clienteId: clienteId || null,
      clienteContato: clienteContato || null,
      criadoEm: Date.now(),
    };

    const novo = await fbPost('pedidos', pedido);

    return res.status(200).json({ pedidoId: novo.name, ...pedido });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
