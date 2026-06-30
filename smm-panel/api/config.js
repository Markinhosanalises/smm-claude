// api/config.js
// Endpoint admin: salva URL/KEY do fornecedor e o percentual de lucro global.
// Protegido por PIN simples (mesmo padrão dos outros painéis admin do Marcos).

const { fbPatch, fbGet } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { pin } = req.query;
    if (pin !== ADMIN_PIN) {
      return res.status(401).json({ erro: 'PIN inválido' });
    }
    const config = await fbGet('config').catch(() => null);
    // nunca devolve a key crua pro frontend, só indica se está configurada
    return res.status(200).json({
      fornecedorConfigurado: !!(config && config.fornecedor && config.fornecedor.key),
      url: config?.fornecedor?.url || '',
      lucroPercentualGlobal: config?.lucroPercentualGlobal ?? 30,
    });
  }

  if (req.method === 'POST') {
    const { pin, url, key, lucroPercentualGlobal } = req.body || {};

    if (pin !== ADMIN_PIN) {
      return res.status(401).json({ erro: 'PIN inválido' });
    }

    const update = {};
    if (url && key) {
      update.fornecedor = { url, key };
    }
    if (lucroPercentualGlobal !== undefined) {
      update.lucroPercentualGlobal = Number(lucroPercentualGlobal);
    }

    await fbPatch('config', update);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ erro: 'Método não permitido' });
};
