// api/sync-services.js
// Endpoint admin: puxa a lista de serviços do fornecedor e mescla com o
// catálogo salvo no Firebase, SEM apagar customizações já feitas
// (nome customizado, ativo/inativo, lucro por serviço).

const { fbGet, fbPut } = require('../lib/firebase');
const { listarServicos } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { pin } = req.body || {};
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ erro: 'PIN inválido' });
  }

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
        // customizações do admin (preservadas se já existiam):
        ativo: existente.ativo ?? false, // novo serviço entra desativado por padrão
        redeSocial: existente.redeSocial ?? '',
        servicoTipo: existente.servicoTipo ?? '', // ex: seguidores, curtidas, comentários
        lucroPercentual: existente.lucroPercentual ?? null, // null = usa o global
        icone: existente.icone || '',
        atualizadoEm: Date.now(),
      };
    }

    await fbPut('catalogo', novoCatalogo);

    return res.status(200).json({
      ok: true,
      totalServicos: Object.keys(novoCatalogo).length,
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
