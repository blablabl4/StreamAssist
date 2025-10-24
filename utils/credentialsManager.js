/**
 * Gerenciador de Credenciais IPTV
 * Permite consultar e gerenciar credenciais existentes dos clientes
 */

const fs = require('fs');
const path = require('path');
const Database = require('../database/database');

class CredentialsManager {
  constructor() {
    this.db = new Database();
    this.credentialsFile = path.join(__dirname, '..', 'data', 'client-credentials.json');
    this.ensureCredentialsFile();
  }

  ensureCredentialsFile() {
    if (!fs.existsSync(this.credentialsFile)) {
      fs.writeFileSync(this.credentialsFile, JSON.stringify({}, null, 2));
    }
  }

  /**
   * Salvar credenciais de um cliente
   */
  saveCredentials(telefone, credenciais, tipo = 'teste') {
    try {
      const data = this.loadCredentialsData();
      
      if (!data[telefone]) {
        data[telefone] = {};
      }
      
      data[telefone][tipo] = {
        ...credenciais,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        active: true
      };
      
      fs.writeFileSync(this.credentialsFile, JSON.stringify(data, null, 2));
      console.log(`✅ Credenciais ${tipo} salvas para ${telefone}`);
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar credenciais:', error.message);
      return false;
    }
  }

  /**
   * Buscar credenciais de um cliente
   */
  getCredentials(telefone) {
    try {
      const data = this.loadCredentialsData();
      const clientData = data[telefone];
      
      if (!clientData) {
        return null;
      }
      
      // Atualizar último acesso
      Object.keys(clientData).forEach(tipo => {
        if (clientData[tipo]) {
          clientData[tipo].lastAccessed = new Date().toISOString();
        }
      });
      
      data[telefone] = clientData;
      fs.writeFileSync(this.credentialsFile, JSON.stringify(data, null, 2));
      
      return clientData;
    } catch (error) {
      console.error('❌ Erro ao buscar credenciais:', error.message);
      return null;
    }
  }

  /**
   * Verificar se cliente tem credenciais ativas
   */
  hasActiveCredentials(telefone) {
    const credentials = this.getCredentials(telefone);
    if (!credentials) return false;
    
    return Object.keys(credentials).some(tipo => 
      credentials[tipo] && credentials[tipo].active
    );
  }

  /**
   * Formatar credenciais para envio via WhatsApp
   */
  formatCredentialsMessage(telefone) {
    const credentials = this.getCredentials(telefone);
    
    if (!credentials) {
      return `❌ *NENHUMA CONTA ENCONTRADA*

Você ainda não possui contas IPTV cadastradas.

💡 *COMO CRIAR UMA CONTA:*
• Digite *TESTE* para conta gratuita (limitada)
• Digite *MENSAL* para conta oficial (R$ 35,00)
• Digite *TRIMESTRAL* para conta oficial (R$ 90,00)
• Digite *SEMESTRAL* para conta oficial (R$ 170,00)
• Digite *ANUAL* para conta oficial (R$ 300,00)

❓ *PRECISA DE AJUDA?*
Digite *SUPORTE* para falar conosco.`;
    }

    let message = `📺 *SUAS CREDENCIAIS IPTV*\n\n`;
    
    // Conta teste
    if (credentials.teste && credentials.teste.active) {
      const teste = credentials.teste;
      message += `🧪 *CONTA TESTE:*
👤 Usuário: ${teste.usuario}
🔑 Senha: ${teste.senha}
📅 Criada em: ${new Date(teste.createdAt).toLocaleDateString('pt-BR')}
⏰ Status: ${teste.vencimento ? 'Ativa até ' + teste.vencimento : 'Ativa (limitada)'}

`;
    }

    // Conta oficial
    if (credentials.oficial && credentials.oficial.active) {
      const oficial = credentials.oficial;
      message += `💎 *CONTA OFICIAL:*
👤 Usuário: ${oficial.usuario}
🔑 Senha: ${oficial.senha}
📅 Criada em: ${new Date(oficial.createdAt).toLocaleDateString('pt-BR')}
⏰ Vencimento: ${oficial.vencimento || 'N/A'}
📦 Pacote: ${this.getPackageName(oficial.pacote)}

`;
    }

    // Links IPTV
    const anyCredential = credentials.teste || credentials.oficial;
    if (anyCredential && anyCredential.links) {
      message += `🔗 *LINKS IPTV DISPONÍVEIS:*
Escolha um dos links para configurar no seu app:

${anyCredential.links.map((link, i) => `${i + 1}. ${link}`).join('\n')}

`;
    }

    message += `📱 *COMO USAR:*
1. Baixe um app IPTV (VU Player, Smart IPTV, etc)
2. Configure com suas credenciais
3. Use um dos links fornecidos
4. Aproveite!

💰 *QUER RENOVAR OU UPGRADE?*
• Digite *MENSAL*, *TRIMESTRAL*, *SEMESTRAL* ou *ANUAL*

❓ *PRECISA DE AJUDA?*
• Digite *SUPORTE* para falar conosco
• Digite *TUTORIAL* para ver como configurar

✅ Suas credenciais estão sempre disponíveis aqui!`;

    return message;
  }

  /**
   * Obter nome do pacote
   */
  getPackageName(pacote) {
    const packages = {
      1: 'Completo com adultos',
      2: 'Completo sem adultos'
    };
    return packages[pacote] || 'Pacote ' + pacote;
  }

  /**
   * Carregar dados do arquivo
   */
  loadCredentialsData() {
    try {
      const content = fs.readFileSync(this.credentialsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Erro ao carregar credenciais:', error.message);
      return {};
    }
  }

  /**
   * Marcar credenciais como inativas
   */
  deactivateCredentials(telefone, tipo) {
    try {
      const data = this.loadCredentialsData();
      
      if (data[telefone] && data[telefone][tipo]) {
        data[telefone][tipo].active = false;
        data[telefone][tipo].deactivatedAt = new Date().toISOString();
        
        fs.writeFileSync(this.credentialsFile, JSON.stringify(data, null, 2));
        console.log(`✅ Credenciais ${tipo} desativadas para ${telefone}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Erro ao desativar credenciais:', error.message);
      return false;
    }
  }

  /**
   * Listar todos os clientes com credenciais
   */
  getAllClients() {
    try {
      const data = this.loadCredentialsData();
      return Object.keys(data).map(telefone => ({
        telefone,
        credentials: data[telefone]
      }));
    } catch (error) {
      console.error('❌ Erro ao listar clientes:', error.message);
      return [];
    }
  }

  /**
   * Estatísticas de credenciais
   */
  getStats() {
    try {
      const data = this.loadCredentialsData();
      const clients = Object.keys(data);
      
      let testAccounts = 0;
      let officialAccounts = 0;
      let activeAccounts = 0;
      
      clients.forEach(telefone => {
        const clientData = data[telefone];
        if (clientData.teste && clientData.teste.active) {
          testAccounts++;
          activeAccounts++;
        }
        if (clientData.oficial && clientData.oficial.active) {
          officialAccounts++;
          activeAccounts++;
        }
      });
      
      return {
        totalClients: clients.length,
        testAccounts,
        officialAccounts,
        activeAccounts
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
      return null;
    }
  }
}

module.exports = CredentialsManager;
