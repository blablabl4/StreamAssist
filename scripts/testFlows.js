// scripts/testFlows.js
const { logger } = require('../utils/configLoader');

async function testFlow(flowName, context) {
  try {
    const flow = require(`../flows/${flowName}Flow.js`);
    logger.info({ event: 'test_flow', flow: flowName, telefone: context.telefone });
    await flow(context);
    console.log(`✅ Flow '${flowName}' executado com sucesso.`);
  } catch (e) {
    logger.error({ event: 'erro_test_flow', flow: flowName, error: e.message });
    console.error(`❌ Erro ao executar flow '${flowName}':`, e);
  }
}

(async () => {
  const contextBase = {
    telefone: '11999999999',
    cliente: { id: 1, telefone: '11999999999' },
    userState: {},
    sendMessage: (msg) => { console.log('[BOT]', msg); },
    logger
  };

  await testFlow('mainMenu', contextBase);
  await testFlow('plans', contextBase);
  await testFlow('status', contextBase);
  await testFlow('renew', contextBase);
  await testFlow('tutorial', contextBase);
  await testFlow('trial', contextBase);
})();
