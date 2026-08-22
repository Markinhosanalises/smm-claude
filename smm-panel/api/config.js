// api/config.js
const { fbPatch, fbGet, fbPut } = require('../lib/firebase');
const { saldoFornecedor } = require('../lib/fornecedor');
const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin, action } = req.query;

    // action=balance
    if (action === 'balance') {
      if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });
      try {
        const data = await saldoFornecedor();
        const saldo = data.saldo ?? data.balance;
        const moeda = data.moeda ?? data.currency;
        if (saldo === undefined) return res.status(502).json({ erro: 'Resposta inesperada do fornecedor' });
        return res.status(200).json({ saldo, moeda });
      } catch (err) {
        return res.status(500).json({ erro: err.message });
      }
    }

    // action=vitrine — lista produtos da vitrine (público)
    if (action === 'vitrine') {
      const vitrine = await fbGet('vitrine').catch(() => null);
      const produtos = Object.entries(vitrine || {})
        .map(([id, p]) => ({ id, ...p }))
        .filter(p => p.ativo)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return res.status(200).json({ produtos });
    }

    // action=vitrine-admin — lista todos (admin)
    if (action === 'vitrine-admin') {
      if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });
      const vitrine = await fbGet('vitrine').catch(() => null);
      const produtos = Object.entries(vitrine || {})
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return res.status(200).json({ produtos });
    }

    // sem PIN: público
    if (!pin) {
      const configPublica = await fbGet('config').catch(() => null);
      return res.status(200).json({
        whatsappSuporte: configPublica?.whatsappSuporte || '',
        minRecarga: configPublica?.minRecarga || 5,
        ordemServicos: configPublica?.ordemServicos || 'padrao',
      });
    }

    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    const config = await fbGet('config').catch(() => null);
    return res.status(200).json({
      fornecedorConfigurado: !!(config && config.fornecedor && config.fornecedor.key),
      url: config?.fornecedor?.url || '',
      lucroPercentualGlobal: config?.lucroPercentualGlobal ?? 30,
      cotacaoUSDBRL: config?.cotacaoUSDBRL || '',
      whatsappSuporte: config?.whatsappSuporte || '',
      mpConfigurado: !!(config?.mercadopago?.accessToken),
      appUrl: config?.appUrl || '',
      minRecarga: config?.minRecarga || 5,
      ordemServicos: config?.ordemServicos || 'padrao',
      ultimaVerificacaoFornecedor: config?.ultimaVerificacaoFornecedor || null,
      ultimaVerificacaoResultado: config?.ultimaVerificacaoResultado || null,
    });
  }

  if (req.method === 'POST') {
    const { pin, action } = req.body || {};
    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    // action=vitrine-salvar — salva/atualiza produto da vitrine
    if (action === 'vitrine-salvar') {
      const { id, nome, descricao, preco, imagemUrl, linkContato, ativo, ordem } = req.body;
      const produtoId = id || `prod_${Date.now()}`;
      await fbPut(`vitrine/${produtoId}`, {
        nome: nome || '',
        descricao: descricao || '',
        preco: preco || '',
        imagemUrl: imagemUrl || '',
        linkContato: linkContato || '',
        ativo: ativo !== false,
        ordem: Number(ordem || 0),
        atualizadoEm: Date.now(),
      });
      return res.status(200).json({ ok: true, id: produtoId });
    }

    // action=vitrine-remover
    if (action === 'vitrine-remover') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ erro: 'id obrigatório' });
      await fbPut(`vitrine/${id}`, null);
      return res.status(200).json({ ok: true });
    }

    // config geral
    const { url, key, lucroPercentualGlobal, cotacaoUSDBRL, whatsappSuporte,
            mpAccessToken, appUrl, minRecarga, ordemServicos } = req.body;

    const update = {};
    if (url && key) update.fornecedor = { url, key };
    if (lucroPercentualGlobal !== undefined) update.lucroPercentualGlobal = Number(lucroPercentualGlobal);
    if (cotacaoUSDBRL !== undefined) update.cotacaoUSDBRL = cotacaoUSDBRL === '' ? null : Number(cotacaoUSDBRL);
    if (whatsappSuporte !== undefined) update.whatsappSuporte = whatsappSuporte;
    if (mpAccessToken !== undefined) update.mercadopago = { accessToken: mpAccessToken };
    if (appUrl !== undefined) update.appUrl = appUrl;
    if (minRecarga !== undefined) update.minRecarga = minRecarga === null ? 5 : Number(minRecarga);
    if (ordemServicos !== undefined) update.ordemServicos = ordemServicos;

    await fbPatch('config', update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
