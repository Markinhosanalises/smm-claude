// api/services.js
const { fbGet } = require('../lib/firebase');

function traduzirNome(nome) {
  if (!nome) return nome;
  const termos = {
    'Followers': 'Seguidores','followers': 'seguidores',
    'Likes': 'Curtidas','likes': 'curtidas',
    'Views': 'Visualizações','views': 'visualizações',
    'Comments': 'Comentários','comments': 'comentários',
    'Shares': 'Compartilhamentos','shares': 'compartilhamentos',
    'Subscribers': 'Inscritos','subscribers': 'inscritos',
    'Real': 'Reais','real': 'reais',
    'Brazilian': 'Brasileiros','brazilian': 'brasileiros',
    'Fast': 'Rápido','fast': 'rápido',
    'Instant': 'Instantâneo','instant': 'instantâneo',
    'High Quality': 'Alta Qualidade','high quality': 'alta qualidade',
    'No Refill': 'Sem Reposição','no refill': 'sem reposição',
    'With Refill': 'Com Reposição','with refill': 'com reposição',
    'Refill': 'Reposição','refill': 'reposição',
    'Story': 'Story','Impressions': 'Impressões','impressions': 'impressões',
    'Reach': 'Alcance','reach': 'alcance',
    'Profile Visit': 'Visitas ao Perfil','profile visit': 'visitas ao perfil',
    'Save': 'Salvamentos','save': 'salvamentos',
    'Mixed': 'Misturados','mixed': 'misturados',
    'Worldwide': 'Mundial','worldwide': 'mundial',
    'Global': 'Global','Organic': 'Orgânico','organic': 'orgânico',
    'Bot': 'Bot','Max': 'Máx','Min': 'Mín',
    'Custom': 'Personalizado','custom': 'personalizado',
    'Targeted': 'Segmentado','targeted': 'segmentado',
    'Arabic': 'Árabe','Indian': 'Indiano','USA': 'EUA','UK': 'Reino Unido',
    'Stable': 'Estável','stable': 'estável',
    'Cheap': 'Econômico','cheap': 'econômico',
    'Premium': 'Premium','HQ': 'Alta Qualidade',
    'Old Accounts': 'Contas Antigas','old accounts': 'contas antigas',
    'Drop': 'Queda','drop': 'queda',
    'Non Drop': 'Sem Queda','non drop': 'sem queda','Non-Drop': 'Sem Queda',
    'Reels': 'Reels','Live': 'Ao Vivo','live': 'ao vivo',
    'Poll': 'Enquete','poll': 'enquete',
    'Mention': 'Menção','mention': 'menção',
    'Auto': 'Auto','auto': 'auto',
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
    const cotacao = config?.cotacaoUSDBRL || null;
    const ativos = Object.values(catalogo || {}).filter((s) => s && s.ativo && !s.indisponivel);

    const { redeSocial, servicoTipo } = req.query;

    // Sem filtros: devolve redes e tipos disponíveis
    if (!redeSocial && !servicoTipo) {
      // deduplicar ignorando maiúsculas/minúsculas — mantém o primeiro encontrado
      const redesMap = new Map();
      const tiposMap = new Map();
      ativos.forEach(s => {
        if (s.redeSocial) {
          const key = s.redeSocial.toLowerCase();
          if (!redesMap.has(key)) redesMap.set(key, s.redeSocial);
        }
        if (s.servicoTipo) {
          const key = s.servicoTipo.toLowerCase();
          if (!tiposMap.has(key)) tiposMap.set(key, s.servicoTipo);
        }
      });
      return res.status(200).json({
        redesSociais: [...redesMap.values()],
        tiposServico: [...tiposMap.values()],
      });
    }

    // Filtra com case-insensitive
    let filtrados = ativos;
    if (redeSocial) {
      const rLower = redeSocial.toLowerCase();
      filtrados = filtrados.filter((s) => (s.redeSocial || '').toLowerCase() === rLower);
    }
    if (servicoTipo) {
      const tLower = servicoTipo.toLowerCase();
      filtrados = filtrados.filter((s) => (s.servicoTipo || '').toLowerCase() === tLower);
    }

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
