// api/meus-pedidos.js
const { fbGet } = require('../lib/firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const { clienteId } = req.query;
  if (!clienteId) return res.status(400).json({ erro: 'clienteId é obrigatório' });

  try {
    const pedidos = (await fbGet('pedidos')) || {};
    const lista = Object.entries(pedidos)
      .filter(([, p]) => p.clienteId === clienteId)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.criadoEm - a.criadoEm);
    return res.status(200).json({ pedidos: lista });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
