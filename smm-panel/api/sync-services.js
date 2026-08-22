// api/sync-services.js
// POST { pin } → sincroniza catálogo com o fornecedor (admin)
// GET  Authorization: Bearer CRON_SECRET → verifica serviços indisponíveis (cron)

const { fbGet, fbPut, fbPatch } = require('../lib/firebase');
const { listarServicos } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';
const CRON_SECRET = process.env.CRON_SECRET || 'cron-smm-891322';

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
        novoCatalogo[id] = {
          idFornecedor: id,
          nomeOriginal: s.nome ?? s.name ?? '',
          nomeCustomizado: existente.nomeCustomizado ?? s.nome ?? s.name ?? '',
          categoriaOriginal: s.categoria ?? s.category ?? '',
          tipo: s.tipo ?? s.type ?? '',
          taxaCusto: parseFloat(String(s.taxa ?? s.rate ?? '0').replace(',', '.')),
          min: Number(s.min ?? 0),
          max: Number(s.máximo ?? s.max ?? 0),
          refill: !!(s.reabastecer ?? s.refill),
          cancel: !!(s.cancelar ?? s.cancel),
          ativo: existente.ativo ?? false,
          redeSocial: existente.redeSocial ?? '',
          servicoTipo: existente.servicoTipo ?? '',
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
