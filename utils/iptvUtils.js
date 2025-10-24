const axios = require('axios');
const IPTVAutomation = require('./iptvAutomation');

class IPTVUtils {
  constructor() {
    this.serverUrl = process.env.IPTV_SERVER_URL;
    this.apiKey = process.env.IPTV_API_KEY;
  }

  // Gerar credenciais únicas para o usuário
  gerarCredenciais(telefone) {
    const timestamp = Date.now();
    const usuario = `user_${telefone.replace(/\D/g, '')}_${timestamp}`;
    const senha = this.gerarSenhaAleatoria(8);
    
    return {
      usuario,
      senha,
      urlServidor: this.serverUrl
    };
  }

  // Gerar senha aleatória
  gerarSenhaAleatoria(tamanho) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let resultado = '';
    for (let i = 0; i < tamanho; i++) {
      resultado += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return resultado;
  }

  // Criar usuário no servidor IPTV via automação
  async criarUsuarioIPTV(credenciais, plano, isTrial = false) {
    const automation = new IPTVAutomation();
    
    try {
      console.log(`Criando usuário IPTV ${isTrial ? 'TESTE' : 'PAGO'}:`, credenciais.usuario);
      
      const dadosUsuario = {
        username: credenciais.usuario,
        password: credenciais.senha,
        package: plano,
        max_connections: this.obterMaxConexoes(plano),
        trial_duration: isTrial ? 24 : null, // 24 horas para teste
        expiry_date: isTrial ? null : this.calcularDataExpiracao(30) // 30 dias para pago
      };

      let resultado;
      if (isTrial) {
        resultado = await automation.criarUsuarioTeste(dadosUsuario);
      } else {
        resultado = await automation.criarUsuarioPago(dadosUsuario);
      }
      
      await automation.close();
      
      if (resultado.success) {
        console.log('✅ Usuário IPTV criado com sucesso:', credenciais.usuario);
        return {
          success: true,
          data: resultado.data
        };
      } else {
        throw new Error(resultado.error);
      }

    } catch (error) {
      console.error('❌ Erro ao criar usuário IPTV:', error);
      await automation.close();
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter número máximo de conexões baseado no plano
  obterMaxConexoes(plano) {
    const conexoesPorPlano = {
      'basico': 1,
      'premium': 2,
      'familia': 3,
      'vip': 5
    };
    
    return conexoesPorPlano[plano.toLowerCase()] || 1;
  }

  // Desativar usuário IPTV via automação
  async desativarUsuarioIPTV(usuario) {
    const automation = new IPTVAutomation();
    
    try {
      console.log('Desativando usuário IPTV:', usuario);
      
      const resultado = await automation.desativarUsuario(usuario);
      await automation.close();
      
      if (resultado.success) {
        console.log('✅ Usuário IPTV desativado:', usuario);
        return { success: true };
      } else {
        throw new Error(resultado.error);
      }

    } catch (error) {
      console.error('❌ Erro ao desativar usuário IPTV:', error);
      await automation.close();
      return { success: false, error: error.message };
    }
  }

  // Formatar mensagem com credenciais
  formatarMensagemCredenciais(credenciais, plano, dataVencimento) {
    return `🎉 *IPTV ATIVADO COM SUCESSO!* 🎉

📺 *Suas credenciais de acesso:*

👤 *Usuário:* ${credenciais.usuario}
🔐 *Senha:* ${credenciais.senha}
🌐 *Servidor:* ${credenciais.urlServidor}

📋 *Detalhes da assinatura:*
📦 *Plano:* ${plano.toUpperCase()}
📅 *Válido até:* ${new Date(dataVencimento).toLocaleDateString('pt-BR')}
📱 *Conexões simultâneas:* ${this.obterMaxConexoes(plano)}

📲 *Como usar:*
1. Baixe um aplicativo IPTV (recomendamos: IPTV Smarters, TiviMate)
2. Configure com os dados acima
3. Aproveite seus canais!

⚠️ *Importante:*
- Não compartilhe suas credenciais
- Respeite o limite de conexões
- Em caso de problemas, entre em contato

✅ *Suporte disponível 24h*
Obrigado por escolher nossos serviços! 🚀`;
  }

  // Calcular data de expiração
  calcularDataExpiracao(dias) {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  }

  // Criar usuário teste (trial)
  async criarUsuarioTeste(credenciais, plano) {
    return await this.criarUsuarioIPTV(credenciais, plano, true);
  }

  // Explorar portal IPTV (para debug/configuração)
  async explorarPortalIPTV() {
    const automation = new IPTVAutomation();
    
    try {
      const resultado = await automation.explorarPortal();
      await automation.close();
      return resultado;
    } catch (error) {
      console.error('Erro ao explorar portal:', error);
      await automation.close();
      return { success: false, error: error.message };
    }
  }

  // Formatar mensagem de vencimento próximo
  formatarMensagemVencimento(nome, dataVencimento, diasRestantes) {
    return `⚠️ *AVISO DE VENCIMENTO* ⚠️

Olá ${nome || 'Cliente'}!

Sua assinatura IPTV vence em *${diasRestantes} dias*
📅 *Data de vencimento:* ${new Date(dataVencimento).toLocaleDateString('pt-BR')}

Para renovar sua assinatura e não perder o acesso:
1️⃣ Digite *RENOVAR*
2️⃣ Escolha seu plano
3️⃣ Efetue o pagamento via PIX

💡 *Renove agora e evite interrupções!*

Digite *MENU* para ver todas as opções.`;
  }
}

module.exports = IPTVUtils;
