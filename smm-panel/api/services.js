// api/services.js
// Endpoint público (cliente). Retorna apenas os serviços ATIVOS,
// já com o preço final (custo + markup, convertido pra BRL se configurado).
//
// Query params opcionais:
//   ?redeSocial=instagram
//   ?servicoTipo=seguidores
// Sem params: devolve a lista de redes sociais e tipos disponíveis
// (pra montar os dois primeiros filtros sem precisar trazer tudo).

const { fbGet } = require('../lib/firebase');

function calcularPreco(servico, lucroGlobal, cotacao) {
  const lucroPct = servico.lucroPercentual ?? lucroGlobal ?? 30;
  const custoPorMil = servico.taxaCusto * (cotacao || 1);
  const precoPorMil = custoPorMil * (1 + lucroPct / 100);
  return Math.round(precoPorMil * 100) / 100;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const [catalogo, config] = await Promise.all([
      fbGet('catalogo'),
      fbGet('config'),
    ]);

    const lucroGlobal = config?.lucroPercentualGlobal ?? 30;
    const cotacao = config?.cotacaoUSDBRL || null; // se null, não converte (assume taxa já na moeda final)

    const ativos = Object.values(catalogo || {}).filter((s) => s && s.ativo);

    const { redeSocial, servicoTipo } = req.query;

    // Sem filtros: devolve só as opções pros dois primeiros seletores
    if (!redeSocial && !servicoTipo) {
      const redes = [...new Set(ativos.map((s) => s.redeSocial).filter(Boolean))];
      const tipos = [...new Set(ativos.map((s) => s.servicoTipo).filter(Boolean))];
      return res.status(200).json({ redesSociais: redes, tiposServico: tipos });
    }

    let filtrados = ativos;
    if (redeSocial) filtrados = filtrados.filter((s) => s.redeSocial === redeSocial);
    if (servicoTipo) filtrados = filtrados.filter((s) => s.servicoTipo === servicoTipo);

    const resultado = filtrados.map((s) => ({
      id: s.idFornecedor,
      nome: s.nomeCustomizado || s.nomeOriginal,
      servicoTipo: s.servicoTipo,
      icone: s.icone || '',
      min: s.min,
      max: s.max,
      refill: s.refill,
      precoPorMil: calcularPreco(s, lucroGlobal, cotacao),
    }));

    return res.status(200).json({ servicos: resultado });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
