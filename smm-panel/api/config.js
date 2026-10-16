// api/config.js
const { fbPatch, fbGet, fbPut, key: validKey } = require('../lib/firebase');
const { saldoFornecedor } = require('../lib/fornecedor');
const { requireAdmin, session } = require('../lib/auth');
const { endpoint, mutation, number, url: validateUrl, fail } = require('../lib/http');

module.exports = endpoint(async (req, res) => {
  if (req.method === 'POST') mutation(req);
  if (req.method === 'GET') {
    const { pin, action } = req.query;

    // action=balance
    if (action === 'balance') {
      await requireAdmin(req);
      try {
        const data = await saldoFornecedor();
        const saldo = data.saldo ?? data.balance;
        const moeda = data.moeda ?? data.currency;
        if (saldo === undefined) return res.status(502).json({ erro: 'Resposta inesperada do fornecedor' });
        return res.status(200).json({ saldo, moeda });
      } catch (err) {
        return res.status(500).json({ erro: 'Não foi possível concluir a operação.' });
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
      await requireAdmin(req);
      const vitrine = await fbGet('vitrine').catch(() => null);
      const produtos = Object.entries(vitrine || {})
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return res.status(200).json({ produtos });
    }

    // sem PIN: público
    if (!await session(req, 'admin', true)) {
      const configPublica = await fbGet('config').catch(() => null);
      return res.status(200).json({
        whatsappSuporte: configPublica?.whatsappSuporte || '',
        minRecarga: configPublica?.minRecarga || 5,
        ordemServicos: configPublica?.ordemServicos || 'padrao',
      });
    }

    await requireAdmin(req);

    const config = await fbGet('config').catch(() => null);
    return res.status(200).json({
      fornecedorConfigurado: !!(config && config.fornecedor && config.fornecedor.key),
      url: config?.fornecedor?.url || '',
      lucroPercentualGlobal: config?.lucroPercentualGlobal ?? 30,
      cotacaoUSDBRL: config?.cotacaoUSDBRL || '',
      whatsappSuporte: config?.whatsappSuporte || '',
      mpConfigurado: !!(process.env.MP_ACCESS_TOKEN || config?.mercadopago?.accessToken),
      appUrl: process.env.APP_URL || '',
      webhookConfigurado: !!process.env.MP_WEBHOOK_SECRET,
      minRecarga: config?.minRecarga || 5,
      ordemServicos: config?.ordemServicos || 'padrao',
      ultimaVerificacaoFornecedor: config?.ultimaVerificacaoFornecedor || null,
      ultimaVerificacaoResultado: config?.ultimaVerificacaoResultado || null,
    });
  }

  if (req.method === 'POST') {
    const { pin, action } = req.body || {};
    await requireAdmin(req);

    // action=vitrine-salvar — salva/atualiza produto da vitrine
    if (action === 'vitrine-salvar') {
      const { id, nome, descricao, preco, imagemUrl, linkContato, ativo, ordem } = req.body;
      const produtoId = id ? validKey(id) : `prod_${Date.now()}`;
      if (imagemUrl) validateUrl(imagemUrl, 'Imagem');
      if (linkContato) validateUrl(linkContato, 'Contato');
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
      await fbPut(`vitrine/${validKey(id)}`, null);
      return res.status(200).json({ ok: true });
    }

    // config geral
    const { url, key, lucroPercentualGlobal, cotacaoUSDBRL, whatsappSuporte,
            mpAccessToken, appUrl, minRecarga, ordemServicos } = req.body;

    const update = {};
    if (url && key) { require('../lib/fornecedor').validateProviderUrl(url); update.fornecedor = { url, key }; }
    if (lucroPercentualGlobal !== undefined) update.lucroPercentualGlobal = number(lucroPercentualGlobal, 'Margem', 0, 100000);
    if (cotacaoUSDBRL !== undefined) update.cotacaoUSDBRL = cotacaoUSDBRL === '' ? null : number(cotacaoUSDBRL, 'Cotação', 0.000001, 100000);
    if (whatsappSuporte !== undefined) update.whatsappSuporte = whatsappSuporte;
    if (mpAccessToken) update.mercadopago = { accessToken: mpAccessToken };
    if (appUrl && appUrl.replace(/\/$/, '') !== process.env.APP_URL?.replace(/\/$/, '')) fail('URL deve coincidir com APP_URL configurada no servidor');
    if (minRecarga !== undefined) update.minRecarga = minRecarga === null ? 5 : number(minRecarga, 'Recarga mínima', 0.01, 1000000);
    if (ordemServicos !== undefined) update.ordemServicos = ordemServicos;

    await fbPatch('config', update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
});
