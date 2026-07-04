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
        origem: req.body?.origem || 'nao_informado',
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

    // ===== SET DESCONTO (admin) =====
    if (acao === 'set-desconto') {
      const { pin, clienteId: cid, desconto } = req.body || {};
      if (pin !== ADMIN_PIN) return res.status(401).json({ erro: 'PIN inválido' });
      const id = normalizarWhats(cid) || cid;
      await fbPatch(`clientes/${id}`, { desconto: Number(desconto || 0) });
      return res.status(200).json({ ok: true });
    }

    // ===== GERAR CHAVE DE API =====
    if (acao === 'gerar-chave') {
      const { clienteId } = req.body || {};
      const id = normalizarWhats(clienteId);
      const cli = await fbGet(`clientes/${id}`).catch(() => null);
      if (!cli || cli.senha !== senha) return res.status(401).json({ erro: 'Senha incorreta' });

      const crypto = require('crypto');
      if (cli.apiKey) {
        await fbPatch(`api_keys/${cli.apiKey}`, { revogada: true }).catch(() => {});
      }
      const novaChave = 'fsx_' + crypto.randomBytes(24).toString('hex');
      await fbPatch(`clientes/${id}`, { apiKey: novaChave });
      await fbPut(`api_keys/${novaChave}`, { clienteId: id, criadoEm: Date.now() });
      return res.status(200).json({ chave: novaChave });
    }

    // ===== REVOGAR CHAVE DE API =====
    if (acao === 'revogar-chave') {
      const { clienteId } = req.body || {};
      const id = normalizarWhats(clienteId);
      const cli = await fbGet(`clientes/${id}`).catch(() => null);
      if (!cli || cli.senha !== senha) return res.status(401).json({ erro: 'Senha incorreta' });

      if (cli.apiKey) {
        await fbPatch(`api_keys/${cli.apiKey}`, { revogada: true }).catch(() => {});
      }
      await fbPatch(`clientes/${id}`, { apiKey: null });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação inválida' });
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
};

// ===== Geração de chave de API (adicionado aqui pra economizar função) =====
// Exporta como rota separada via module.exports.gerarChave
const crypto = require('crypto');

async function gerarChaveAPI(req, res) {
  const { fbGet: fbG, fbPut: fbP, fbPatch: fbPa } = require('../lib/firebase');

  if (req.method === 'GET') {
    const { clienteId, senha } = req.query;
    if (!clienteId || !senha) return res.status(400).json({ erro: 'clienteId e senha obrigatórios' });
    const cliente = await fbG(`clientes/${clienteId}`).catch(() => null);
    if (!cliente || cliente.senha !== senha) return res.status(401).json({ erro: 'Não autorizado' });
    return res.status(200).json({ chave: cliente.apiKey || null });
  }

  if (req.method === 'POST') {
    const { clienteId, senha, acao } = req.body || {};
    if (!clienteId || !senha) return res.status(400).json({ erro: 'clienteId e senha obrigatórios' });
    const cliente = await fbG(`clientes/${clienteId}`).catch(() => null);
    if (!cliente || cliente.senha !== senha) return res.status(401).json({ erro: 'Não autorizado' });

    if (acao === 'revogar') {
      if (cliente.apiKey) await fbPa(`api_keys/${cliente.apiKey}`, { revogada: true }).catch(() => {});
      await fbPa(`clientes/${clienteId}`, { apiKey: null });
      return res.status(200).json({ ok: true });
    }

    if (cliente.apiKey) await fbPa(`api_keys/${cliente.apiKey}`, { revogada: true }).catch(() => {});
    const novaChave = 'fsx_' + crypto.randomBytes(24).toString('hex');
    await fbPa(`clientes/${clienteId}`, { apiKey: novaChave });
    await fbP(`api_keys/${novaChave}`, { clienteId, criadoEm: Date.now() });
    return res.status(200).json({ chave: novaChave });
  }
  return res.status(405).json({ erro: 'Método não permitido' });
}

module.exports.gerarChave = gerarChaveAPI;
