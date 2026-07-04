// api/config.js
const { fbPatch, fbGet } = require('../lib/firebase');
const { saldoFornecedor } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin, action } = req.query;

    // action=balance — saldo do fornecedor (antes era /api/balance)
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

    // sem PIN: devolve só o que é seguro pro cliente ver
    if (!pin) {
      const configPublica = await fbGet('config').catch(() => null);
      return res.status(200).json({
        whatsappSuporte: configPublica?.whatsappSuporte || '',
        minRecarga: configPublica?.minRecarga || 5,
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
    });
  }

  if (req.method === 'POST') {
    const { pin, url, key, lucroPercentualGlobal, cotacaoUSDBRL, whatsappSuporte, mpAccessToken, appUrl, minRecarga } = req.body || {};

    if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

    const update = {};
    if (url && key) update.fornecedor = { url, key };
    if (lucroPercentualGlobal !== undefined) update.lucroPercentualGlobal = Number(lucroPercentualGlobal);
    if (cotacaoUSDBRL !== undefined) update.cotacaoUSDBRL = cotacaoUSDBRL === '' ? null : Number(cotacaoUSDBRL);
    if (whatsappSuporte !== undefined) update.whatsappSuporte = whatsappSuporte;
    if (mpAccessToken !== undefined) update.mercadopago = { accessToken: mpAccessToken };
    if (appUrl !== undefined) update.appUrl = appUrl;
    if (minRecarga !== undefined) update.minRecarga = minRecarga === null ? 5 : Number(minRecarga);

    await fbPatch('config', update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
