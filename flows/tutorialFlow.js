// flows/tutorialFlow.js
const { loadConfig, defaultMessages, messagesSchema } = require('../utils/configLoader');

module.exports = async function tutorialFlow(context) {
  const { sendMessage, telefone, logger } = context;
  let messages = loadConfig('messages.json', defaultMessages, messagesSchema);
  await sendMessage(messages.tutorials || '5️⃣ *TUTORIAIS* - Como instalar IPTV em cada dispositivo:\n1️⃣ Samsung\n2️⃣ Android TV\n3️⃣ LG\n4️⃣ Roku\n5️⃣ PC\n6️⃣ SS IPTV\n7️⃣ TV Box\n8️⃣ Android Mobile\nEscolha um número para ver o tutorial correspondente.');
  context.userState.step = 'escolher_tutorial';
};
