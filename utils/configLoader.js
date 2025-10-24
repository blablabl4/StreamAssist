const fs = require('fs');
const path = require('path');
const winston = require('winston');
const Ajv = require('ajv');
const ajv = new Ajv();

// Logger configurado para console e arquivo
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, '../logs/app.log') })
  ]
});

const defaultMessages = {
  menu: "🎬 *BEM-VINDO AO IPTV BOT* 🎬\nEscolha uma opção digitando apenas o *NÚMERO*:...",
  planos: "📺 *PLANOS DISPONÍVEIS*\n1️⃣ Básico ...",
  status_sem_assinatura: "❌ Você não possui assinaturas ativas. Digite *1* para ver planos disponíveis.",
  erro_padrao: "❌ Opção inválida. Digite *0* para voltar ao menu principal.",
  tutorials: "5️⃣ *TUTORIAIS* - Como instalar IPTV...",
  voltar_menu: "Digite *0* para voltar ao menu principal."
};
const defaultPlans = [
  { id: "basic", name: "Básico", price: 15.00, connections: 1, description: "1 conexão, canais SD/HD, suporte básico" },
  { id: "premium", name: "Premium", price: 25.00, connections: 2, description: "2 conexões, canais HD, suporte prioritário" },
  { id: "familia", name: "Família", price: 35.00, connections: 3, description: "3 conexões, canais HD/4K, suporte família" },
  { id: "vip", name: "VIP", price: 50.00, connections: 5, description: "5 conexões, todos canais, suporte VIP" }
];

// Schemas básicos para validação
const messagesSchema = { type: 'object', properties: { menu: {type:'string'}, planos: {type:'string'}, status_sem_assinatura: {type:'string'}, erro_padrao: {type:'string'}, tutorials: {type:'string'}, voltar_menu: {type:'string'} }, required: ['menu','planos','erro_padrao'] };
const plansSchema = { type: 'array', items: { type: 'object', properties: { id: {type:'string'}, name: {type:'string'}, price: {type:'number'}, connections: {type:'number'}, description: {type:'string'} }, required: ['id','name','price','connections','description'] } };

function loadConfig(filename, fallback, schema = null) {
  try {
    const filePath = path.join(__dirname, '../config', filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (schema && !ajv.validate(schema, data)) {
      logger.error(`Config ${filename} inválido: ${ajv.errorsText()}`);
      return fallback;
    }
    return data;
  } catch (e) {
    logger.error(`Erro ao carregar ${filename}: ${e.message}`);
    return fallback;
  }
}

module.exports = { logger, loadConfig, defaultMessages, defaultPlans, messagesSchema, plansSchema };
