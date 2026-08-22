// api/sync-services.js
// POST { pin } → sincroniza catálogo com o fornecedor (admin)
// GET  Authorization: Bearer CRON_SECRET → verifica serviços indisponíveis (cron)

const { fbGet, fbPut, fbPatch } = require('../lib/firebase');
const { listarServicos } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';
const CRON_SECRET = process.env.CRON_SECRET || 'cron-smm-891322';

function detectarRede(categoria, nome){
  const texto = (categoria + ' ' + nome).toLowerCase();
  if(texto.includes('instagram')) return 'instagram';
  if(texto.includes('tiktok') || texto.includes('tik tok')) return 'tiktok';
  if(texto.includes('youtube') || texto.includes('you tube')) return 'youtube';
  if(texto.includes('facebook')) return 'facebook';
  if(texto.includes('twitter') || texto.includes(' x ') || texto.includes('tweet')) return 'twitter';
  if(texto.includes('spotify')) return 'spotify';
  if(texto.includes('telegram')) return 'telegram';
  if(texto.includes('pinterest')) return 'pinterest';
  if(texto.includes('linkedin')) return 'linkedin';
  if(texto.includes('snapchat')) return 'snapchat';
  if(texto.includes('twitch')) return 'twitch';
  if(texto.includes('soundcloud')) return 'soundcloud';
  if(texto.includes('kwai')) return 'kwai';
  if(texto.includes('threads')) return 'threads';
  if(texto.includes('whatsapp')) return 'whatsapp';
  if(texto.includes('shazam')) return 'shazam';
  if(texto.includes('apple music') || texto.includes('apple')) return 'apple music';
  if(texto.includes('google')) return 'google';
  if(texto.includes('discord')) return 'discord';
  if(texto.includes('clubhouse')) return 'clubhouse';
  return '';
}

function detectarTipo(categoria, nome){
  const texto = (categoria + ' ' + nome).toLowerCase();
  if(texto.includes('follower') || texto.includes('seguidor') || texto.includes('subscriber') || texto.includes('inscrit')) return 'Seguidores';
  if(texto.includes('like') || texto.includes('curtida')) return 'Curtidas';
  if(texto.includes('view') || texto.includes('visuali') || texto.includes('play') || texto.includes('reproduç')) return 'Visualizações';
  if(texto.includes('comment') || texto.includes('comentar')) return 'Comentários';
  if(texto.includes('share') || texto.includes('compartilh')) return 'Compartilhamentos';
  if(texto.includes('story') || texto.includes('storie')) return 'Story';
  if(texto.includes('reels') || texto.includes('reel')) return 'Reels';
  if(texto.includes('live') || texto.includes('ao vivo')) return 'Live';
  if(texto.includes('save') || texto.includes('salva')) return 'Salvamentos';
  if(texto.includes('impression')) return 'Impressões';
  if(texto.includes('reach') || texto.includes('alcance')) return 'Alcance';
  if(texto.includes('mention')) return 'Menções';
  if(texto.includes('member') || texto.includes('membro')) return 'Membros';
  if(texto.includes('review') || texto.includes('avalia')) return 'Avaliações';
  if(texto.includes('stream') || texto.includes('ouvinte')) return 'Reproduções';
  return 'Outros';
}

module.exports = async (req, res) => {

  // ===== GET — cron de verificação diária =====
  if (req.method === 'GET') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    try {
      const servicosFornecedor = await listarServicos();
      if (!Array.isArray(servicosFornecedor)) {
        return res.status(502).json({ erro: 'Resposta inválida do fornecedor' });
      }

      const idsAtivos = new Set(
        servicosFornecedor.map(s => String(s.serviço ?? s.service ?? s.id))
      );

      const catalogo = (await fbGet('catalogo')) || {};
      let desativados = 0, reativados = 0;
      const alteracoes = [];

      for (const [id, servico] of Object.entries(catalogo)) {
        if (!servico || !servico.ativo) continue;
        const existeNoFornecedor = idsAtivos.has(String(id));

        if (!existeNoFornecedor && !servico.indisponivel) {
          await fbPatch(`catalogo/${id}`, { indisponivel: true, indisponivel_desde: Date.now() });
          desativados++;
          alteracoes.push({ id, nome: servico.nomeCustomizado || servico.nomeOriginal, acao: 'desativado' });
        } else if (existeNoFornecedor && servico.indisponivel) {
          await fbPatch(`catalogo/${id}`, { indisponivel: false, indisponivel_desde: null });
          reativados++;
          alteracoes.push({ id, nome: servico.nomeCustomizado || servico.nomeOriginal, acao: 'reativado' });
        }
      }

      await fbPatch('config', {
        ultimaVerificacaoFornecedor: Date.now(),
        ultimaVerificacaoResultado: { desativados, reativados, total: servicosFornecedor.length },
      });

      return res.status(200).json({ ok: true, totalFornecedor: servicosFornecedor.length, desativados, reativados, alteracoes });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  // ===== POST — sincronização manual (admin) =====
  if (req.method === 'POST') {
    const { pin } = req.body || {};
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    try {
      const servicosFornecedor = await listarServicos();
      if (!Array.isArray(servicosFornecedor)) {
        return res.status(502).json({ erro: 'Resposta inesperada do fornecedor', detalhe: servicosFornecedor });
      }

      const catalogoAtual = (await fbGet('catalogo')) || {};
      const novoCatalogo = {};

      for (const s of servicosFornecedor) {
        const id = String(s.serviço ?? s.service ?? s.id);
        if (!id) continue;
        const existente = catalogoAtual[id] || {};
        const categoriaOrig = s.categoria ?? s.category ?? '';
        const nomeOrig = s.nome ?? s.name ?? '';
        const redeDetectada = existente.redeSocial || detectarRede(categoriaOrig, nomeOrig);
        const tipoDetectado = existente.servicoTipo || detectarTipo(categoriaOrig, nomeOrig);

        novoCatalogo[id] = {
          idFornecedor: id,
          nomeOriginal: nomeOrig,
          nomeCustomizado: existente.nomeCustomizado ?? nomeOrig,
          categoriaOriginal: categoriaOrig,
          tipo: s.tipo ?? s.type ?? '',
          taxaCusto: parseFloat(String(s.taxa ?? s.rate ?? '0').replace(',', '.')),
          min: Number(s.min ?? 0),
          max: Number(s.máximo ?? s.max ?? 0),
          refill: !!(s.reabastecer ?? s.refill),
          cancel: !!(s.cancelar ?? s.cancel),
          ativo: existente.ativo ?? true,
          redeSocial: redeDetectada,
          servicoTipo: tipoDetectado,
          icone: existente.icone || '',
          lucroPercentual: existente.lucroPercentual ?? null,
          indisponivel: false,
          atualizadoEm: Date.now(),
        };
      }

      await fbPut('catalogo', novoCatalogo);
      return res.status(200).json({ ok: true, totalServicos: Object.keys(novoCatalogo).length });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
