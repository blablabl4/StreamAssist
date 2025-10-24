// flows/statusFlow.js
const { loadConfig, defaultMessages, messagesSchema } = require('../utils/configLoader');

module.exports = async function statusFlow(context) {
  const { sendMessage, cliente, telefone } = context;
  const db = context.db || require('../database/database');

  // Buscar assinaturas ativas do cliente
  let assinaturas = [];
  try {
    assinaturas = await db.db.all(`
      SELECT * FROM assinaturas 
      WHERE cliente_id = ? AND status = 'ativa'
      ORDER BY data_vencimento DESC
    `, [cliente.id]);
  } catch (e) {
    await sendMessage('❌ Erro ao buscar assinaturas. Tente novamente mais tarde.');
    return;
  }

  if (!assinaturas.length) {
    await sendMessage(defaultMessages.status_sem_assinatura || '❌ Você não possui assinaturas ativas. Digite *1* para ver planos disponíveis.');
    return;
  }

  let statusMsg = '📋 *STATUS DAS SUAS ASSINATURAS*\n\n';
  for (const assinatura of assinaturas) {
    const dataVencimento = new Date(assinatura.data_vencimento);
    const hoje = new Date();
    const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
    statusMsg += `📦 *Plano:* ${assinatura.plano.toUpperCase()}\n`;
    statusMsg += `💰 *Valor:* R$ ${assinatura.valor.toFixed(2)}\n`;
    statusMsg += `📅 *Vence em:* ${diasRestantes} dias (${dataVencimento.toLocaleDateString('pt-BR')})\n`;
    statusMsg += `✅ *Status:* ${assinatura.status.toUpperCase()}\n`;
    if (assinatura.usuario_iptv) {
      statusMsg += `👤 *Usuário:* ${assinatura.usuario_iptv}\n`;
      statusMsg += `🔐 *Senha:* ${assinatura.senha_iptv}\n`;
    }
    statusMsg += '\n---\n\n';
  }
  await sendMessage(statusMsg);
};
