// Exemplo inicial para fluxo de menu principal
module.exports = async function mainMenuFlow(context) {
  const { sendMessage, userState, messages } = context;
  await sendMessage(messages.menu);
  userState.step = 'menu';
};
