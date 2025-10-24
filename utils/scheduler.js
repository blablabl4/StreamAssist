const cron = require('node-cron');
const Database = require('../database/database');
const IPTVUtils = require('./iptvUtils');

class Scheduler {
  constructor(messageHandler) {
    this.messageHandler = messageHandler;
    this.db = new Database();
    this.iptvUtils = new IPTVUtils();
    this.init();
  }

  init() {
    // Verificar vencimentos todos os dias às 9h
    cron.schedule('0 9 * * *', () => {
      console.log('Executando verificação diária de vencimentos...');
      this.verificarVencimentosDiarios();
    });

    // Desativar assinaturas vencidas todos os dias às 10h
    cron.schedule('0 10 * * *', () => {
      console.log('Executando desativação de assinaturas vencidas...');
      this.desativarAssinaturasVencidas();
    });

    // Limpeza de transações pendentes antigas (7 dias) - toda segunda às 2h
    cron.schedule('0 2 * * 1', () => {
      console.log('Executando limpeza de transações antigas...');
      this.limparTransacoesAntigas();
    });

    console.log('Agendador de tarefas inicializado!');
  }

  async verificarVencimentosDiarios() {
    try {
      // Avisos para assinaturas que vencem em 3 dias
      const assinaturasVencendo3 = await this.db.buscarAssinaturasVencendo(3);
      for (const assinatura of assinaturasVencendo3) {
        const diasRestantes = this.calcularDiasRestantes(assinatura.data_vencimento);
        if (diasRestantes === 3) {
          const mensagem = this.iptvUtils.formatarMensagemVencimento(
            assinatura.nome,
            assinatura.data_vencimento,
            diasRestantes
          );
          await this.messageHandler.enviarMensagem(assinatura.telefone, mensagem);
        }
      }

      // Avisos para assinaturas que vencem em 1 dia
      const assinaturasVencendo1 = await this.db.buscarAssinaturasVencendo(1);
      for (const assinatura of assinaturasVencendo1) {
        const diasRestantes = this.calcularDiasRestantes(assinatura.data_vencimento);
        if (diasRestantes === 1) {
          const mensagem = `🚨 *ÚLTIMO AVISO* 🚨

Olá ${assinatura.nome || 'Cliente'}!

Sua assinatura IPTV vence *AMANHÃ*!
📅 *Data de vencimento:* ${new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR')}

⚠️ *ATENÇÃO:* Após o vencimento, seu acesso será suspenso automaticamente.

Para renovar:
1️⃣ Digite *RENOVAR*
2️⃣ Escolha seu plano
3️⃣ Efetue o pagamento

💡 *Renove AGORA e evite interrupções!*`;

          await this.messageHandler.enviarMensagem(assinatura.telefone, mensagem);
        }
      }

      console.log(`Verificação de vencimentos concluída. ${assinaturasVencendo3.length + assinaturasVencendo1.length} avisos enviados.`);

    } catch (error) {
      console.error('Erro na verificação diária de vencimentos:', error);
    }
  }

  async desativarAssinaturasVencidas() {
    try {
      // Buscar assinaturas vencidas (data_vencimento < hoje)
      const assinaturasVencidas = await this.db.db.all(`
        SELECT a.*, c.telefone, c.nome 
        FROM assinaturas a 
        JOIN clientes c ON a.cliente_id = c.id 
        WHERE a.status = 'ativa' 
        AND DATE(a.data_vencimento) < DATE('now')
      `);

      for (const assinatura of assinaturasVencidas) {
        // Desativar no servidor IPTV
        if (assinatura.usuario_iptv) {
          await this.iptvUtils.desativarUsuarioIPTV(assinatura.usuario_iptv);
        }

        // Atualizar status no banco
        await this.db.db.run(
          'UPDATE assinaturas SET status = ? WHERE id = ?',
          ['vencida', assinatura.id]
        );

        // Notificar cliente
        const mensagem = `❌ *ASSINATURA VENCIDA* ❌

Olá ${assinatura.nome || 'Cliente'}!

Sua assinatura IPTV foi suspensa devido ao vencimento.

📦 *Plano:* ${assinatura.plano.toUpperCase()}
📅 *Venceu em:* ${new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR')}

Para reativar:
1️⃣ Digite *RENOVAR*
2️⃣ Escolha seu plano
3️⃣ Efetue o pagamento

Após o pagamento, seu acesso será reativado automaticamente! 🚀`;

        await this.messageHandler.enviarMensagem(assinatura.telefone, mensagem);
      }

      console.log(`${assinaturasVencidas.length} assinaturas vencidas foram desativadas.`);

    } catch (error) {
      console.error('Erro ao desativar assinaturas vencidas:', error);
    }
  }

  async limparTransacoesAntigas() {
    try {
      // Remover transações pendentes com mais de 7 dias
      const resultado = await this.db.db.run(`
        DELETE FROM transacoes 
        WHERE status = 'pendente' 
        AND DATE(created_at) < DATE('now', '-7 days')
      `);

      console.log(`${resultado.changes} transações antigas foram removidas.`);

    } catch (error) {
      console.error('Erro ao limpar transações antigas:', error);
    }
  }

  calcularDiasRestantes(dataVencimento) {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = vencimento - hoje;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

module.exports = Scheduler;
