const policy=require('../lib/catalog-policy');
// api/sync-services.js
// POST { pin } → sincroniza catálogo com o fornecedor (admin)
// GET  Authorization: Bearer CRON_SECRET → verifica serviços indisponíveis (cron)

const { fbGet, fbPut, fbPatch, fbTransaction, key } = require('../lib/firebase');
const { listarServicos } = require('../lib/fornecedor');
const catalogText=require('../public/catalog-text');
const forms=require('../public/service-forms');

const { requireAdmin, session } = require('../lib/auth');
const { endpoint, mutation, number, url, fail } = require('../lib/http');
const CRON_SECRET = process.env.CRON_SECRET;

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

module.exports = endpoint(async (req, res) => {
  if (req.method === 'POST') mutation(req);

  // ===== GET — cron de verificação diária =====
  if (req.method === 'GET') {
    const authHeader = req.headers['authorization'] || '';
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ erro: 'Não autorizado' });
    }

    try {
      const recuperados = await require('../lib/orders').recover();
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
        if (!servico) continue;
        const blocked = policy.reason(servico);
        if (blocked) { if(servico.ativo) { await fbPatch('catalogo/'+id,{ativo:false,bloqueioComercial:blocked});desativados++; } continue; }
        if (!servico.ativo) continue;
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

      return res.status(200).json({ ok: true, totalFornecedor: servicosFornecedor.length, desativados, reativados, alteracoes, recuperados });
    } catch (err) {
      return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
    }
  }

  // ===== POST action=detectar — redetecta rede/tipo em todos os serviços sem rede =====
  if (req.method === 'POST') {
    const { pin, action } = req.body || {};
    await requireAdmin(req);

    if (action === 'detectar') {
      try {
        const catalogo = (await fbGet('catalogo')) || {};
        let atualizados = 0;

        for (const [id, s] of Object.entries(catalogo)) {
          if (!s) continue;
          // força redetecção em TODOS (não só os vazios)
          const rede = catalogText.network(s.categoriaOriginal || '', s.nomeOriginal || s.nomeCustomizado || '');
          const tipo = catalogText.objective(s.categoriaOriginal || '', s.nomeOriginal || s.nomeCustomizado || '',s.tipo);
          const update = {};
          if (rede && rede !== s.redeSocial) { update.redeSocial = rede; }
          if (tipo && tipo !== s.servicoTipo) { update.servicoTipo = tipo; }
          if (Object.keys(update).length > 0) {
            await fbPatch(`catalogo/${id}`, update);
            atualizados++;
          }
        }

        return res.status(200).json({ ok: true, atualizados, total: Object.keys(catalogo).length });
      } catch (err) {
        return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
      }
    }

    // ===== POST normal — sincronização manual =====
    try {
      const servicosFornecedor = await listarServicos();
      if (!Array.isArray(servicosFornecedor)) {
        return res.status(502).json({ erro: 'Resposta inesperada do fornecedor', detalhe: servicosFornecedor });
      }

      const catalogoAtual = (await fbGet('catalogo')) || {};
      const ativarNovosServicos=!!(await fbGet('config/ativarNovosServicos'));
      const novoCatalogo = {};

      for (const s of servicosFornecedor) {
        const rawId = s.serviço ?? s.service ?? s.id;
        if (rawId === undefined || rawId === null) continue;
        const id = key(rawId);
        const existente = catalogoAtual[id] || {};
        const categoriaOrig = s.categoria ?? s.category ?? '';
        const nomeOrig = s.nome ?? s.name ?? '';
        const redeDetectada = catalogText.network(categoriaOrig,nomeOrig);
        const tipoDetectado = catalogText.objective(categoriaOrig,nomeOrig,s.tipo??s.type??'Default');

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
          dripfeed: !!s.dripfeed,
          descricaoOriginal: String(s.description??s.descricao??''),
          ativo: ativarNovosServicos ? true : (existente.ativo ?? false),
          redeSocial: redeDetectada,
          servicoTipo: tipoDetectado,
          icone: existente.icone || '',
          lucroPercentual: existente.lucroPercentual ?? null,
          indisponivel: false,
          atualizadoEm: Date.now(),
        };
      }

      await fbTransaction('catalogo', current => {
        const merged = { ...(current || {}) };
        for (const [id, incoming] of Object.entries(novoCatalogo)) {
          const prior = current?.[id];
          const next = { ...incoming };
          // Preserve concurrent administrator edits, including changes made during this fetch.
          if (prior) for (const field of ['ativo','nomeCustomizado','redeSocial','servicoTipo','icone','lucroPercentual']) {
            if (prior[field] !== undefined) next[field] = prior[field];
          }
          if (catalogText.technical(next) || !forms.describe(next).supported || !Number.isFinite(next.taxaCusto) || next.taxaCusto <= 0 || !Number.isSafeInteger(next.min) || !Number.isSafeInteger(next.max) || next.min < 1 || next.max < next.min) {
            next.ativo = false; next.indisponivel = true;
            if (!Number.isFinite(next.taxaCusto)) next.taxaCusto = 0;
            if (!Number.isFinite(next.min)) next.min = 0;
            if (!Number.isFinite(next.max)) next.max = 0;
          }
          next.adicionadoEm = prior ? (prior.adicionadoEm || 0) : Date.now();
          merged[id] = policy.apply(next);
        }
        for (const [id, prior] of Object.entries(current || {})) {
          if (prior && !novoCatalogo[id]) merged[id] = { ...prior, indisponivel: true };
        }
        return merged;
      });
      return res.status(200).json({ ok: true, totalServicos: Object.keys(novoCatalogo).length });
    } catch (err) {
      return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
});
