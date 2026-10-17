const policy=require('../lib/catalog-policy');
// api/admin-services.js
const { fbGet, fbPatch, key } = require('../lib/firebase');
const { requireAdmin, session } = require('../lib/auth');
const { endpoint, mutation, number, url, fail } = require('../lib/http');

module.exports = endpoint(async (req, res) => {
  if (req.method === 'POST') mutation(req);
  if (req.method === 'GET') {
    const { pin, busca, somenteAtivos, somenteIndisponiveis, redeSocial, servicoTipo, ordenar, pagina } = req.query;
    await requireAdmin(req);

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
      return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
    }
  }

  if (req.method === 'POST') {
    const { pin, idFornecedor, ativo, nomeCustomizado, redeSocial, servicoTipo, lucroPercentual, icone } = req.body || {};
    await requireAdmin(req);
    if (!idFornecedor) return res.status(400).json({ erro: 'idFornecedor é obrigatório' });

    const update = {};
    if (ativo !== undefined) update.ativo = !!ativo;
    if (nomeCustomizado !== undefined) update.nomeCustomizado = nomeCustomizado;
    if (redeSocial !== undefined) update.redeSocial = redeSocial;
    if (servicoTipo !== undefined) update.servicoTipo = servicoTipo;
    if (icone !== undefined) update.icone = icone;
    if (lucroPercentual !== undefined) {
      update.lucroPercentual = lucroPercentual === '' || lucroPercentual === null ? null : number(lucroPercentual, 'Margem', 0, 100000);
    }

    const prior = await fbGet('catalogo/'+key(idFornecedor));
    if (update.ativo && policy.reason({...prior,...update})) fail('Serviço bloqueado pela seleção comercial do catálogo.',409);
    await fbPatch('catalogo/'+key(idFornecedor), update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
});
