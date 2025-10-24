// flows/trialFlow.js
const { createTestIfEligible } = require('../utils/accountGates');
const { loadConfig, defaultMessages, messagesSchema } = require('../utils/configLoader');

module.exports = async function trialFlow(context) {
  const { sendMessage, telefone, cliente, logger } = context;
  let messages = loadConfig('messages.json', defaultMessages, messagesSchema);
  await sendMessage(messages.trial || '6️⃣ *TESTE GRÁTIS* - Conta teste limitada. Aguarde...');
  const resp = await createTestIfEligible({ telefone, pacote: 2, anotacoes: 'Gerado via WhatsApp' });
  if (resp && resp.success) {
    // Simula salvamento e envio de credenciais teste
    await sendMessage('✅ Teste criado com sucesso! Usuário: ' + resp.usuario + ' Senha: ' + resp.senha);
  } else if (resp && resp.reason === 'cooldown') {
    await sendMessage('⏳ Você já usou seu teste grátis. Aguarde ' + (resp.remainingDays || 60) + ' dias para novo teste.');
  } else {
    await sendMessage('❌ Não foi possível criar o teste grátis.');
  }
};
