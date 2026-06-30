// api/balance.js
const { saldoFornecedor } = require('../lib/fornecedor');

const ADMIN_PIN = process.env.ADMIN_PIN || '891322';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ erro: 'Método não permitido' });

  const { pin } = req.query;
  if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });

  try {
    const saldo = await saldoFornecedor();
    return res.status(200).json(saldo);
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
