const axios = require('axios');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { loadConfig, logger } = require('../utils/configLoader');
const database = require('../database/database');

const PAGHIPER_PIX_URL = 'https://pix.paghiper.com/invoice/create/'; // URL da API PIX da PagHiper

// Função para gerar cobrança PIX
async function gerarCobrancaPix(cliente, plano) {
  logger.info({ event: 'iniciar_cobranca_pix', telefone: cliente.telefone, plano });
  try {
    const apiKey = process.env.PAGHIPER_API_KEY || process.env.PAGHIPER_APIKEY;
    const token = process.env.PAGHIPER_TOKEN;
    if (!apiKey) {
      return { success: false, error: 'Chave da PagHiper ausente (.env PAGHIPER_API_KEY)' };
    }
    if (!token) {
      return { success: false, error: 'Token da PagHiper ausente (.env PAGHIPER_TOKEN)' };
    }
    const valor = obterValorPlano(plano);
    const vencimento = calcularVencimento(30); // 30 dias de teste

    const payload = {
      apiKey,
      token,
      order_id: `IPTV-${Date.now()}`,
      payer_email: cliente.telefone + '@whatsapp.com',
      payer_name: cliente.nome || 'Cliente IPTV',
      payer_cpf_cnpj: '11144477735', // CPF válido para testes
      payer_phone: cliente.telefone,
      days_due_date: '1',

      items: [{
        item_id: '1',
        description: `Assinatura IPTV - Plano ${plano}`,
        quantity: '1',
        price_cents: (valor * 100).toString(), // valor em centavos
      }]
    };

    const response = await axios.post(PAGHIPER_PIX_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = response.data || {};
    // Log mínimo (chaves) para debug sem vazar dados sensíveis
    try { console.log('PagHiper keys:', Object.keys(data)); } catch {}

    // Erro explícito
    if (data.create_request && data.create_request.result === 'reject') {
      throw new Error(data.create_request.response_message);
    }

    // Normalização de campos entre possíveis formatos
    const createRequest = data.create_request || {};
    const pixRequest = data.pix_create_request || data.pix || {};

    let qrCodeLink = pixRequest.qrcode_image_url || pixRequest.qrcode || pixRequest.qrCodeImageUrl || null;
    let pixCode = pixRequest.pix_code || pixRequest.qr_code_text || pixRequest.code || null;
    let transactionId = createRequest.transaction_id || pixRequest.transaction_id || data.transaction_id || null;
    const orderId = createRequest.order_id || pixRequest.order_id || data.order_id || null;

    // Alguns provedores retornam objetos estruturados para pix_code
    if (pixCode && typeof pixCode === 'object') {
      // Tentar campos comuns
      pixCode = pixCode.emv || pixCode.copy_paste || pixCode.text || JSON.stringify(pixCode);
    }

    // Fallbacks para QR: se não veio link, tentar derivar do pix_code
    if (!qrCodeLink && pixCode) {
      if (typeof pixCode === 'string' && /^https?:\/\//i.test(pixCode)) {
        qrCodeLink = pixCode; // alguns gateways retornam um link direto
      } else if (typeof pixCode === 'string') {
        const encoded = encodeURIComponent(pixCode);
        qrCodeLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
      }
    }

    const cobranca = {
      success: true,
      qrCode: qrCodeLink || 'N/A',
      qrCodeText: pixCode || 'N/A',
      valor,
      vencimento,
      txid: transactionId,
      orderId
    };
    await database.registrarCobranca(cliente.telefone, cobranca);
    logger.info({ event: 'cobranca_pix_sucesso', telefone: cliente.telefone, cobrancaId: cobranca.txid });
    return cobranca;
  } catch (error) {
    logger.error({ event: 'erro_cobranca_pix', telefone: cliente.telefone, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
};

// Função auxiliar para obter valor do plano
function obterValorPlano(plano) {
  const planos = {
    'mensal': 35.00,      // Plano Mensal - 30 dias
    'trimestral': 90.00,  // Plano Trimestral - 3 meses (economiza R$15)
    'semestral': 170.00,  // Plano Semestral - 6 meses (economiza R$40)
    'anual': 300.00,      // Plano Anual - 12 meses (economiza R$120)
    'instalacao': 20.00   // Taxa de instalação técnica
  };
  return planos[plano.toLowerCase()] || planos.mensal;
}

// Função auxiliar para calcular data de vencimento
function calcularVencimento(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data;
}

// Handler para webhook da PagHiper
exports.handleWebhook = async (req, res) => {
  try {
    const { transaction_id, status } = req.body;
    
    if (status === 'paid') {
      // Aqui você deve implementar a lógica para:
      // 1. Atualizar o status no banco de dados
      // 2. Gerar credenciais IPTV
      // 3. Enviar mensagem para o cliente com as credenciais
      console.log(`Pagamento confirmado para a transação: ${transaction_id}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
};

// Handler para webhook da PagHiper
const handleWebhook = async (req, res) => {
  try {
    console.log('Webhook recebido:', req.body);
    
    const { transaction_id, status } = req.body;
    
    if (!transaction_id) {
      return res.status(400).json({ error: 'Transaction ID não fornecido' });
    }

    // Verificar se o pagamento foi aprovado
    if (status === 'paid' || status === 'completed') {
      // Importar MessageHandler aqui para evitar dependência circular
      const MessageHandler = require('../whatsapp/messageHandler');
      
      // Criar instância temporária para processar o pagamento
      // Em produção, você deve ter uma instância global do messageHandler
      const tempHandler = {
        processarPagamentoAprovado: MessageHandler.prototype.processarPagamentoAprovado
      };
      
      await tempHandler.processarPagamentoAprovado(transaction_id);
      
      console.log(`Pagamento aprovado para transação: ${transaction_id}`);
    }
    
    res.status(200).json({ message: 'Webhook processado com sucesso' });
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { gerarCobrancaPix, handleWebhook };
