// api/auth-cliente.js
// Login simples por WhatsApp + senha (sem Firebase Auth, mesmo padrão REST
// usado nos outros projetos). Não é nível bancário de segurança, mas é
// suficiente pra um cliente acompanhar os próprios pedidos.

const { fbGet, fbPut } = require('../lib/firebase');

function normalizarWhats(numero) {
  return String(numero || '').replace(/\D/g, ''); // só dígitos, vira a chave no Firebase
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { acao, whatsapp, senha, nome } = req.body || {};
  const chave = normalizarWhats(whatsapp);

  if (!chave || !senha) {
    return res.status(400).json({ erro: 'WhatsApp e senha são obrigatórios' });
  }

  try {
    if (acao === 'cadastro') {
      const existente = await fbGet(`clientes/${chave}`).catch(() => null);
      if (existente) {
        return res.status(409).json({ erro: 'Já existe uma conta com esse WhatsApp. Faça login.' });
      }
      await fbPut(`clientes/${chave}`, {
        nome: nome || '',
        whatsapp: chave,
        senha, // simples de propósito; dá pra evoluir pra hash depois se quiser
        criadoEm: Date.now(),
      });
      return res.status(200).json({ clienteId: chave, nome: nome || '' });
    }

    if (acao === 'login') {
      const cliente = await fbGet(`clientes/${chave}`).catch(() => null);
      if (!cliente || cliente.senha !== senha) {
        return res.status(401).json({ erro: 'WhatsApp ou senha incorretos' });
      }
      return res.status(200).json({ clienteId: chave, nome: cliente.nome || '' });
    }

    return res.status(400).json({ erro: 'Ação inválida (use "cadastro" ou "login")' });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
