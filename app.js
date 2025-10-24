require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const MessageHandler = require('./whatsapp/messageHandler');
const app = express();

// Variável global para o messageHandler
let messageHandler;

// Configuração do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicialização do cliente WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: 'whatsapp-session'
  }),
  puppeteer: {
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
  }
});

// QR Code para autenticação
client.on('qr', (qr) => {
  console.log('Escaneie o QR Code abaixo para autenticar no WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Quando autenticado
client.on('authenticated', () => {
  console.log('Autenticado no WhatsApp!');
});

// Quando pronto
client.on('ready', () => {
  console.log('Bot IPTV está pronto!');
  
  // Inicializar messageHandler
  messageHandler = new MessageHandler(client);
  
  // Configurar verificação de vencimentos (a cada 12 horas)
  setInterval(() => {
    messageHandler.verificarVencimentos();
  }, 12 * 60 * 60 * 1000);
  
  console.log('Sistema de verificação de vencimentos ativado!');
});

// Handler para mensagens recebidas
client.on('message', async (message) => {
  if (messageHandler) {
    await messageHandler.handleMessage(message);
  }
});

// Inicialização do cliente WhatsApp
client.initialize();

// Exportar client para uso em outros módulos
module.exports = { client };

// Rotas
app.use('/api', require('./routes'));

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('Erro não tratado:', error);
});

module.exports = { client };
