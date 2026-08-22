// api/admin-services.js
const { fbGet, fbPatch } = require('../lib/firebase');
const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin, busca, somenteAtivos, somenteIndisponiveis, redeSocial, servicoTipo, ordenar, pagina } = req.query;
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    try {
      const catalogo = (await fbGet('catalogo')) || {};
      let lista = Object.values(catalogo).filter(Boolean);

      // filtros de estado
      if (somenteAtivos === '1') lista = lista.filter(s => s.ativo);
      if (somenteIndisponiveis === '1') lista = lista.filter(s => s.ativo && s.indisponivel);

      // filtro por rede social
      if (redeSocial && redeSocial.trim()) {
        const r = redeSocial.trim().toLowerCase();
        lista = lista.filter(s => (s.redeSocial || '').toLowerCase() === r);
      }

      // filtro por tipo de serviço
      if (servicoTipo && servicoTipo.trim()) {
        const t = servicoTipo.trim().toLowerCase();
        lista = lista.filter(s => (s.servicoTipo || '').toLowerCase() === t);
      }

      // busca por texto
      if (busca && busca.trim()) {
        const termo = busca.trim().toLowerCase();
        lista = lista.filter(s =>
          (s.nomeOriginal || '').toLowerCase().includes(termo) ||
          (s.nomeCustomizado || '').toLowerCase().includes(termo) ||
          (s.categoriaOriginal || '').toLowerCase().includes(termo) ||
          (s.redeSocial || '').toLowerCase().includes(termo) ||
          (s.servicoTipo || '').toLowerCase().includes(termo) ||
          String(s.idFornecedor).includes(termo)
        );
      }

      // ordenação
      if (ordenar === 'preco_asc') lista.sort((a, b) => a.taxaCusto - b.taxaCusto);
      else if (ordenar === 'preco_desc') lista.sort((a, b) => b.taxaCusto - a.taxaCusto);
      else lista.sort((a, b) => Number(a.idFornecedor) - Number(b.idFornecedor));

      const total = lista.length;
      const POR_PAGINA = 100;
      const totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
      const paginaAtual = Math.min(Math.max(Number(pagina || 1), 1), totalPaginas);
      const inicio = (paginaAtual - 1) * POR_PAGINA;
      const paginada = lista.slice(inicio, inicio + POR_PAGINA);

      // opções únicas de rede e tipo pra montar os selects de filtro
      const todasRedes = [...new Set(Object.values(catalogo).filter(Boolean).map(s => s.redeSocial).filter(Boolean))].sort();
      const todosTipos = [...new Set(Object.values(catalogo).filter(Boolean).map(s => s.servicoTipo).filter(Boolean))].sort();

      return res.status(200).json({
        servicos: paginada,
        total,
        pagina: paginaAtual,
        totalPaginas,
        porPagina: POR_PAGINA,
        redesDisponiveis: todasRedes,
        tiposDisponiveis: todosTipos,
      });
    } catch (err) {
      return res.status(500).json({ erro: err.message });
    }
  }

  if (req.method === 'POST') {
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
