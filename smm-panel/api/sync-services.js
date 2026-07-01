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

function traduzirNome(nome) {
  if (!nome) return nome;
  const termos = {
    'Followers': 'Seguidores',
    'followers': 'seguidores',
    'Likes': 'Curtidas',
    'likes': 'curtidas',
    'Views': 'Visualizações',
    'views': 'visualizações',
    'Comments': 'Comentários',
    'comments': 'comentários',
    'Shares': 'Compartilhamentos',
    'shares': 'compartilhamentos',
    'Subscribers': 'Inscritos',
    'subscribers': 'inscritos',
    'Real': 'Reais',
    'real': 'reais',
    'Brazilian': 'Brasileiros',
    'brazilian': 'brasileiros',
    'Fast': 'Rápido',
    'fast': 'rápido',
    'Instant': 'Instantâneo',
    'instant': 'instantâneo',
    'High Quality': 'Alta Qualidade',
    'high quality': 'alta qualidade',
    'No Refill': 'Sem Reposição',
    'no refill': 'sem reposição',
    'With Refill': 'Com Reposição',
    'with refill': 'com reposição',
    'Refill': 'Reposição',
    'refill': 'reposição',
    'Story': 'Story',
    'Impressions': 'Impressões',
    'impressions': 'impressões',
    'Reach': 'Alcance',
    'reach': 'alcance',
    'Profile Visit': 'Visitas ao Perfil',
    'profile visit': 'visitas ao perfil',
    'Save': 'Salvamentos',
    'save': 'salvamentos',
    'Mixed': 'Misturados',
    'mixed': 'misturados',
    'Worldwide': 'Mundial',
    'worldwide': 'mundial',
    'Global': 'Global',
    'Organic': 'Orgânico',
    'organic': 'orgânico',
    'Bot': 'Bot',
    'Max': 'Máx',
    'Min': 'Mín',
    'Custom': 'Personalizado',
    'custom': 'personalizado',
    'Targeted': 'Segmentado',
    'targeted': 'segmentado',
    'Arabic': 'Árabe',
    'Indian': 'Indiano',
    'USA': 'EUA',
    'UK': 'Reino Unido',
    'Stable': 'Estável',
    'stable': 'estável',
    'Cheap': 'Econômico',
    'cheap': 'econômico',
    'Premium': 'Premium',
    'HQ': 'Alta Qualidade',
    'Old Accounts': 'Contas Antigas',
    'old accounts': 'contas antigas',
    'Drop': 'Queda',
    'drop': 'queda',
    'Non Drop': 'Sem Queda',
    'non drop': 'sem queda',
    'Non-Drop': 'Sem Queda',
    'Reels': 'Reels',
    'Live': 'Ao Vivo',
    'live': 'ao vivo',
    'Poll': 'Enquete',
    'poll': 'enquete',
    'Mention': 'Menção',
    'mention': 'menção',
    'Auto': 'Auto',
    'auto': 'auto',
  };

  let resultado = nome;
  for (const [en, pt] of Object.entries(termos)) {
    resultado = resultado.replace(new RegExp(`\\b${en}\\b`, 'g'), pt);
  }
  return resultado;
}

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

    const resultado = filtrados.map((s) => {
      const nomeBase = s.nomeCustomizado || s.nomeOriginal || '';
      const nomeExibido = s.nomeCustomizado ? nomeBase : traduzirNome(nomeBase);
      return {
        id: s.idFornecedor,
        nome: nomeExibido,
        servicoTipo: s.servicoTipo,
        tipo: s.tipo || '',
        icone: s.icone || '',
        min: s.min,
        max: s.max,
        refill: s.refill,
        precoPorMil: calcularPreco(s, lucroGlobal, cotacao),
      };
    });

    return res.status(200).json({ servicos: resultado });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
