// api/admin-services.js
// Endpoint admin: lista o catálogo completo (todos os serviços puxados do
// fornecedor, ativos ou não) e permite editar um serviço específico.

const { fbGet, fbPatch } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin, busca, somenteAtivos } = req.query;
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    try {
      const catalogo = (await fbGet('catalogo')) || {};
      let lista = Object.values(catalogo).filter(Boolean);

      if (somenteAtivos === '1') {
        lista = lista.filter((s) => s.ativo);
      }

      if (busca && busca.trim()) {
        const termo = busca.trim().toLowerCase();
        lista = lista.filter((s) =>
          (s.nomeOriginal || '').toLowerCase().includes(termo) ||
          (s.categoriaOriginal || '').toLowerCase().includes(termo) ||
          (s.redeSocial || '').toLowerCase().includes(termo) ||
          (s.servicoTipo || '').toLowerCase().includes(termo) ||
          String(s.idFornecedor).includes(termo)
        );
      }

      const total = lista.length;

      const { ordenar } = req.query;
      if (ordenar === 'preco_asc') {
        lista = lista.sort((a, b) => a.taxaCusto - b.taxaCusto);
      } else if (ordenar === 'preco_desc') {
        lista = lista.sort((a, b) => b.taxaCusto - a.taxaCusto);
      }

      const LIMITE = 200;
      lista = lista.slice(0, LIMITE);

      return res.status(200).json({ servicos: lista, total, limitado: total > LIMITE });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  if (req.method === 'POST') {
    // edita um serviço específico
    const { pin, idFornecedor, ativo, nomeCustomizado, redeSocial, servicoTipo, lucroPercentual, icone } = req.body || {};

    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });
    if (!idFornecedor) return res.status(400).json({ erro: 'idFornecedor é obrigatório' });

    const update = {};
    if (ativo !== undefined) update.ativo = !!ativo;
    if (nomeCustomizado !== undefined) update.nomeCustomizado = nomeCustomizado;
    if (redeSocial !== undefined) update.redeSocial = redeSocial;
    if (servicoTipo !== undefined) update.servicoTipo = servicoTipo;
    if (icone !== undefined) update.icone = icone;
    if (lucroPercentual !== undefined) {
      update.lucroPercentual = lucroPercentual === '' || lucroPercentual === null ? null : Number(lucroPercentual);
    }

    await fbPatch(`catalogo/${idFornecedor}`, update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
