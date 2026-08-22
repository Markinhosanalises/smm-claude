// api/cron-sync.js
// Roda automaticamente 1x por dia via Vercel Cron.
// Verifica quais serviços ativos do catálogo ainda existem no fornecedor.
// Se um serviço sumiu do fornecedor → marca como indisponivel=true no Firebase.
// Se voltou → remove o indisponivel.

const { fbGet, fbPatch } = require('../lib/firebase');
const { listarServicos } = require('../lib/fornecedor');

const CRON_SECRET = process.env.CRON_SECRET || 'cron-smm-891322';

module.exports = async (req, res) => {
  // segurança: só aceita chamada do Vercel Cron ou com o secret
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  try {
    // busca serviços atuais do fornecedor
    const servicosFornecedor = await listarServicos();

    if (!Array.isArray(servicosFornecedor)) {
      return res.status(502).json({ erro: 'Resposta inválida do fornecedor' });
    }

    // monta set com todos os IDs que o fornecedor ainda tem
    const idsAtivos = new Set(
      servicosFornecedor.map(s => String(s.serviço ?? s.service ?? s.id))
    );

    // busca o catálogo atual no Firebase
    const catalogo = (await fbGet('catalogo')) || {};

    let desativados = 0;
    let reativados = 0;
    const alteracoes = [];

    // verifica cada serviço ativo no catálogo
    for (const [id, servico] of Object.entries(catalogo)) {
      if (!servico || !servico.ativo) continue; // ignora os que já estão inativos

      const existeNoFornecedor = idsAtivos.has(String(id));

      if (!existeNoFornecedor && !servico.indisponivel) {
        // sumiu do fornecedor → marca como indisponível
        await fbPatch(`catalogo/${id}`, {
          indisponivel: true,
          indiponivel_desde: Date.now(),
        });
        desativados++;
        alteracoes.push({ id, nome: servico.nomeCustomizado || servico.nomeOriginal, acao: 'desativado' });
      } else if (existeNoFornecedor && servico.indisponivel) {
        // voltou pro fornecedor → remove o indisponível
        await fbPatch(`catalogo/${id}`, {
          indisponivel: false,
          indisponivel_desde: null,
        });
        reativados++;
        alteracoes.push({ id, nome: servico.nomeCustomizado || servico.nomeOriginal, acao: 'reativado' });
      }
    }

    // salva o resultado da última verificação no Firebase
    await fbPatch('config', {
      ultimaVerificacaoFornecedor: Date.now(),
      ultimaVerificacaoResultado: { desativados, reativados, total: servicosFornecedor.length },
    });

    return res.status(200).json({
      ok: true,
      totalFornecedor: servicosFornecedor.length,
      desativados,
      reativados,
      alteracoes,
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
