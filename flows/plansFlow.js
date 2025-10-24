// Exemplo inicial para fluxo de planos
const fs = require('fs');
const path = require('path');

module.exports = async function plansFlow(context) {
  const { sendMessage } = context;
  const plansPath = path.join(__dirname, '../config/plans.json');
  const plans = JSON.parse(fs.readFileSync(plansPath, 'utf-8'));
  let msg = '📺 *PLANOS DISPONÍVEIS*\n';
  plans.forEach((plan, idx) => {
    msg += `${idx + 1}️⃣ *${plan.name}* - R$ ${plan.price.toFixed(2)} (${plan.connections} conexões)\n${plan.description}\n\n`;
  });
  msg += 'Digite o número do plano desejado ou *0* para voltar ao menu principal.';
  await sendMessage(msg);
};
