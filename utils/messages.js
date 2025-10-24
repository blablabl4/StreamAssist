module.exports = {
  // Menu / fluxo principal
  welcome: () => '🎬 *BEM-VINDO AO IPTV BOT* 🎬\n\nOlá! Sou seu assistente IPTV.\n\nDigite *0* para ver o menu de opções.',
  askPaymentConfirmation: () => '💳 *CONFIRMAÇÃO DE PAGAMENTO*\n\nVocê efetuou o pagamento?\n\n1️⃣ *SIM* - Já paguei\n2️⃣ *NÃO* - Ainda não paguei\n\nDigite apenas o *NÚMERO* da opção:',
  paymentConfirmedProcessing: () => 'Pagamento confirmado! Criando sua conta agora... ⏳',
  paymentNotConfirmed: () => 'Ainda não consta pagamento confirmado. Aguarde alguns minutos e responda SIM novamente.',
  paymentNotConfirmedShort: () => 'Não consta pagamento confirmado ainda. Tente novamente em breve.',

  // Teste
  testNotAllowed: (days) => `Você já utilizou o período de teste. Nova tentativa apenas em ${days} dias. Apenas 1 teste por usuário. Sem prorrogação.`,
  testCreating: () => 'Gerando acesso de TESTE... ⏳',

  // Credenciais IPTV geradas com seleção inteligente de links
  credentials(data, deviceInfo = '') {
    const { usuario, senha, vencimento, links = [] } = data;
    const LinkSelector = require('./linkSelector');
    const linkSelector = new LinkSelector();
    
    let message = `🎉 *CONTA IPTV CRIADA COM SUCESSO!*\n\n`;
    message += `👤 *Usuário:* ${usuario}\n`;
    message += `🔑 *Senha:* ${senha}\n`;
    message += `📅 *Vencimento:* ${vencimento}\n\n`;
    
    if (links.length > 0) {
      // Se o usuário informou o dispositivo, usar seleção inteligente
      if (deviceInfo) {
        const recommendation = linkSelector.selectBestLink(links, deviceInfo);
        
        if (recommendation.recommendedLink) {
          message += `🎯 *LINK RECOMENDADO PARA SEU DISPOSITIVO:*\n`;
          message += `📱 *Dispositivo:* ${recommendation.device}\n`;
          message += `🔗 *Link:* ${recommendation.recommendedLink}\n\n`;
          
          if (recommendation.instructions) {
            message += `📋 *INSTRUÇÕES:*\n`;
            recommendation.instructions.forEach(instruction => {
              message += `${instruction}\n`;
            });
            message += `\n`;
          }
          
          if (recommendation.alternativeLinks.length > 0) {
            message += `🔄 *Links alternativos:*\n`;
            recommendation.alternativeLinks.forEach((alt, i) => {
              message += `${i + 1}. ${alt.description}\n   ${alt.url}\n`;
            });
          }
        }
      } else {
        // Seleção padrão se não informou dispositivo
        message += `🔗 *Links disponíveis:*\n`;
        links.slice(0, 3).forEach((link, i) => {
          message += `${i + 1}. ${link}\n`;
        });
        
        if (links.length > 3) {
          message += `... e mais ${links.length - 3} links\n`;
        }
        
        message += `\n💡 *Dica:* Me informe seu dispositivo (ex: "VU Player", "Smart TV") para receber o link ideal!\n`;
      }
    }
    
    message += `\n📱 *COMO USAR:*\n`;
    message += `1. Baixe um app IPTV (VU Player, Smart IPTV, etc)\n`;
    message += `2. Configure com suas credenciais\n`;
    message += `3. Use um dos links fornecidos\n`;
    message += `4. Aproveite!\n\n`;
    
    message += `🔄 *QUER RENOVAR OU UPGRADE?*\n`;
    message += `• Digite *2* para MENSAL\n`;
    message += `• Digite *3* para TRIMESTRAL\n`;
    message += `• Digite *4* para SEMESTRAL\n`;
    message += `• Digite *5* para ANUAL\n\n`;
    
    message += `❓ *PRECISA DE AJUDA?*\n`;
    message += `• Digite *2* para falar conosco\n`;
    message += `• Digite *5* para ver como configurar\n\n`;
    
    message += `✅ Suas credenciais estão sempre disponíveis aqui!\n`;
    
    return message;
  },

  // Erros
  genericError: () => 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  invalidInput: () => 'Entrada inválida. Tente novamente.',
};
