// api/public-config.js
// Endpoint público — expõe SOMENTE dados que são seguros pro cliente ver
// (nunca a URL/key do fornecedor, nunca o PIN).
const { fbGet } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });
  try {
    const config = await fbGet('config').catch(() => null);
    return res.status(200).json({
      whatsappSuporte: config?.whatsappSuporte || '',
    });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
