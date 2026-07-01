// api/auth-cliente.js
// Login por WhatsApp ou usuário + senha.
// O clienteId continua sendo o WhatsApp (só dígitos) — é a chave primária.
// O usuário é salvo como campo extra e indexado em /usuarios/{usuario} -> whatsapp
// pra permitir login por usuário sem varrer todos os clientes.

const { fbGet, fbPut, fbPatch } = require('../lib/firebase');

function normalizarWhats(numero) {
  return String(numero || '').replace(/\D/g, '');
}

function normalizarUsuario(u) {
  return String(u || '').toLowerCase().replace(/[^a-z0-9_\.]/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

  const { acao, whatsapp, usuario, senha, nome } = req.body || {};

  if (!senha) {
    return res.status(400).json({ erro: 'Senha é obrigatória' });
  }

  try {
    // ===== CADASTRO =====
    if (acao === 'cadastro') {
      const chave = normalizarWhats(whatsapp);
      const user = normalizarUsuario(usuario);

      if (!chave) return res.status(400).json({ erro: 'WhatsApp é obrigatório' });
      if (!user || user.length < 3) return res.status(400).json({ erro: 'Usuário deve ter pelo menos 3 caracteres' });
      if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

      // verifica se WhatsApp já existe
      const existenteWhats = await fbGet(`clientes/${chave}`).catch(() => null);
      if (existenteWhats) {
        return res.status(409).json({ erro: 'Já existe uma conta com esse WhatsApp.' });
      }

      // verifica se usuário já existe
      const existenteUser = await fbGet(`usuarios/${user}`).catch(() => null);
      if (existenteUser) {
        return res.status(409).json({ erro: 'Esse usuário já está em uso. Escolha outro.' });
      }

      // salva o cliente
      await fbPut(`clientes/${chave}`, {
        nome,
        whatsapp: chave,
        usuario: user,
        senha,
        criadoEm: Date.now(),
      });

      // índice usuario -> whatsapp
      await fbPut(`usuarios/${user}`, { whatsapp: chave });

      return res.status(200).json({ clienteId: chave, nome, usuario: user });
    }

    // ===== LOGIN =====
    if (acao === 'login') {
      let chave = null;

      if (whatsapp) {
        // login por WhatsApp
        chave = normalizarWhats(whatsapp);
      } else if (usuario) {
        // login por usuário — busca o WhatsApp no índice
        const user = normalizarUsuario(usuario);
        const idx = await fbGet(`usuarios/${user}`).catch(() => null);
        if (!idx || !idx.whatsapp) {
          return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
        }
        chave = idx.whatsapp;
      } else {
        return res.status(400).json({ erro: 'Informe usuário ou WhatsApp' });
      }

      const cliente = await fbGet(`clientes/${chave}`).catch(() => null);
      if (!cliente || cliente.senha !== senha) {
        return res.status(401).json({ erro: 'Usuário/WhatsApp ou senha incorretos' });
      }

      return res.status(200).json({
        clienteId: chave,
        nome: cliente.nome || '',
        usuario: cliente.usuario || '',
      });
    }

    return res.status(400).json({ erro: 'Ação inválida' });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};
