// flows/renewFlow.js
const { loadConfig, defaultMessages, messagesSchema } = require('../utils/configLoader');

module.exports = async function renewFlow(context) {
  const { sendMessage, telefone, cliente, logger } = context;
  // Exibe planos para renovação
  let messages = loadConfig('messages.json', defaultMessages, messagesSchema);
  await sendMessage(messages.planos || '📺 *PLANOS DISPONÍVEIS*\n1️⃣ Mensal...');
  context.userState.step = 'renovar_plano';
};
