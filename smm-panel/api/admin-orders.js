// api/admin-orders.js
const { fbGet } = require('../lib/firebase');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const { pin } = req.query;
  if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

  try {
    const pedidos = (await fbGet('pedidos')) || {};
    const lista = Object.entries(pedidos)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.criadoEm - a.criadoEm);
    return res.status(200).json({ pedidos: lista });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
