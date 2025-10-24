/**
 * Sistema de Auditoria de Pagamentos
 * Registra todas as operações de pagamento para rastreabilidade e segurança
 */

const fs = require('fs');
const path = require('path');

class PaymentAudit {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'data', 'audit');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Registra evento de auditoria
   */
  log(event, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      data,
      ip: this.getClientIP(),
      userAgent: this.getUserAgent()
    };

    // Log em arquivo diário
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `payment-audit-${today}.json`);
    
    try {
      let logs = [];
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(content);
      }
      
      logs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
      
      // Log também no console para debug
      console.log(`[AUDIT] ${event}:`, data);
      
    } catch (error) {
      console.error('[AUDIT ERROR]', error.message);
    }
  }

  /**
   * Eventos específicos de auditoria
   */
  
  // PIX gerado
  pixGenerated(transactionId, telefone, valor, plano) {
    this.log('PIX_GENERATED', {
      transactionId,
      telefone: this.maskPhone(telefone),
      valor,
      plano
    });
  }

  // Verificação de pagamento iniciada
  paymentCheckStarted(transactionId, telefone, attempts) {
    this.log('PAYMENT_CHECK_STARTED', {
      transactionId,
      telefone: this.maskPhone(telefone),
      attempts
    });
  }

  // Resultado da verificação de pagamento
  paymentCheckResult(transactionId, telefone, result) {
    this.log('PAYMENT_CHECK_RESULT', {
      transactionId,
      telefone: this.maskPhone(telefone),
      paid: result.paid,
      attempt: result.attempt,
      lastStatus: result.lastStatus
    });
  }

  // Conta IPTV criada
  accountCreated(transactionId, telefone, accountData) {
    this.log('ACCOUNT_CREATED', {
      transactionId,
      telefone: this.maskPhone(telefone),
      usuario: accountData.usuario,
      tipo: accountData.tipo,
      pacote: accountData.pacote,
      vencimento: accountData.vencimento
    });
  }

  // Tentativa de reutilização bloqueada
  duplicateAttemptBlocked(transactionId, telefone) {
    this.log('DUPLICATE_ATTEMPT_BLOCKED', {
      transactionId,
      telefone: this.maskPhone(telefone),
      severity: 'WARNING'
    });
  }

  // Erro na verificação de pagamento
  paymentCheckError(transactionId, telefone, error) {
    this.log('PAYMENT_CHECK_ERROR', {
      transactionId,
      telefone: this.maskPhone(telefone),
      error: error.message,
      severity: 'ERROR'
    });
  }

  // Erro na criação de conta
  accountCreationError(transactionId, telefone, error) {
    this.log('ACCOUNT_CREATION_ERROR', {
      transactionId,
      telefone: this.maskPhone(telefone),
      error: error.message,
      severity: 'ERROR'
    });
  }

  // Transaction ID inválido
  invalidTransactionId(telefone, transactionId) {
    this.log('INVALID_TRANSACTION_ID', {
      telefone: this.maskPhone(telefone),
      transactionId,
      severity: 'WARNING'
    });
  }

  /**
   * Utilitários
   */
  
  maskPhone(telefone) {
    if (!telefone || telefone.length < 4) return telefone;
    return telefone.substring(0, 4) + '*'.repeat(telefone.length - 4);
  }

  getClientIP() {
    // Em produção, capturar do request
    return 'localhost';
  }

  getUserAgent() {
    // Em produção, capturar do request
    return 'WhatsApp Bot';
  }

  /**
   * Relatórios de auditoria
   */
  
  async getAuditReport(date) {
    const logFile = path.join(this.logDir, `payment-audit-${date}.json`);
    
    if (!fs.existsSync(logFile)) {
      return { error: 'Log não encontrado para a data especificada' };
    }

    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const logs = JSON.parse(content);
      
      const summary = {
        totalEvents: logs.length,
        pixGenerated: logs.filter(l => l.event === 'PIX_GENERATED').length,
        paymentChecks: logs.filter(l => l.event === 'PAYMENT_CHECK_RESULT').length,
        accountsCreated: logs.filter(l => l.event === 'ACCOUNT_CREATED').length,
        duplicateAttempts: logs.filter(l => l.event === 'DUPLICATE_ATTEMPT_BLOCKED').length,
        errors: logs.filter(l => l.data.severity === 'ERROR').length,
        warnings: logs.filter(l => l.data.severity === 'WARNING').length
      };
      
      return { summary, logs };
      
    } catch (error) {
      return { error: 'Erro ao ler log de auditoria: ' + error.message };
    }
  }

  /**
   * Limpeza de logs antigos
   */
  cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      files.forEach(file => {
        if (file.startsWith('payment-audit-') && file.endsWith('.json')) {
          const dateStr = file.replace('payment-audit-', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < cutoffDate) {
            fs.unlinkSync(path.join(this.logDir, file));
            console.log(`[AUDIT] Log antigo removido: ${file}`);
          }
        }
      });
      
    } catch (error) {
      console.error('[AUDIT] Erro na limpeza de logs:', error.message);
    }
  }
}

module.exports = PaymentAudit;
