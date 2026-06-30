// api/admin-services.js
// Endpoint admin: lista o catálogo completo (todos os serviços puxados do
// fornecedor, ativos ou não) e permite editar um serviço específico.

const { fbGet, fbPatch } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin } = req.query;
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    const catalogo = (await fbGet('catalogo')) || {};
    return res.status(200).json({ servicos: Object.values(catalogo) });
  }

  if (req.method === 'POST') {
    // edita um serviço específico
    const { pin, idFornecedor, ativo, nomeCustomizado, redeSocial, servicoTipo, lucroPercentual } = req.body || {};

    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });
    if (!idFornecedor) return res.status(400).json({ erro: 'idFornecedor é obrigatório' });

    const update = {};
    if (ativo !== undefined) update.ativo = !!ativo;
    if (nomeCustomizado !== undefined) update.nomeCustomizado = nomeCustomizado;
    if (redeSocial !== undefined) update.redeSocial = redeSocial;
    if (servicoTipo !== undefined) update.servicoTipo = servicoTipo;
    if (lucroPercentual !== undefined) {
      update.lucroPercentual = lucroPercentual === '' || lucroPercentual === null ? null : Number(lucroPercentual);
    }

    await fbPatch(`catalogo/${idFornecedor}`, update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
