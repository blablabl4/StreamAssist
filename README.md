# Bot IPTV WhatsApp com PagHiper

Bot automatizado para venda de assinaturas IPTV via WhatsApp com pagamento PIX através da PagHiper.

## 🚀 Funcionalidades

- ✅ Interface via WhatsApp usando whatsapp-web.js
- ✅ Integração com PagHiper para pagamentos via PIX
- ✅ Sistema de gerenciamento de assinaturas
- ✅ Banco de dados SQLite para clientes e transações
- ✅ Webhook para notificações de pagamento
- ✅ Envio automático de credenciais IPTV
- ✅ Sistema de notificação de vencimento
- ✅ Agendador de tarefas automatizadas

## 📋 Pré-requisitos

- Node.js 16+ 
- NPM ou Yarn
- Conta na PagHiper
- Servidor IPTV (opcional para integração completa)

## 🔧 Instalação

### Instalação rápida

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd bot-iptv-paghiper
```

2. Execute o script de setup (Linux/Mac):
```bash
./setup.sh
```
> No Windows, execute manualmente: `npm install` e confira o arquivo `.env`.

3. Inicie o bot:
```bash
npm start
```

### Docker (recomendado para produção)

1. Ajuste o arquivo `.env` conforme necessário.
2. Execute:
```bash
docker-compose up --build
```

- Os logs ficam em `./logs/app.log`.
- O banco SQLite e configs são persistidos em volumes locais.

### Configuração das variáveis de ambiente
Edite `.env` conforme o exemplo abaixo:
```env
# Configurações da PagHiper
PAGHIPER_TOKEN=seu_token_aqui
PAGHIPER_API_KEY=sua_apikey_aqui

# Configurações do Webhook
WEBHOOK_BASE_URL=https://seu-dominio.com
PORT=3000

# Configurações do IPTV
IPTV_SERVER_URL=seu_servidor_iptv.com
IPTV_API_KEY=sua_chave_api_iptv
```

## 🚀 Como usar

1. Inicie o bot:
```bash
npm start
```

2. Escaneie o QR Code que aparecerá no terminal com o WhatsApp

3. O bot estará pronto para receber mensagens!

## 💬 Comandos do Bot (flows)

Todos os comandos principais foram migrados para flows modulares:

- `MENU` ou `0` → mainMenuFlow (menu principal)
- `1` ou `PLANOS` → plansFlow (planos disponíveis)
- `2` ou `STATUS` → statusFlow (status da assinatura)
- `4` ou `RENOVAR` → renewFlow (renovação de assinatura)
- `5` ou `TUTORIAIS` → tutorialFlow (lista de tutoriais)
- `6` ou `TESTE` → trialFlow (teste grátis)

Os flows são roteados automaticamente pelo messageHandler.js. Se um flow não existir, o fallback antigo é usado.

### Exemplos de uso
- Envie `1` para ver planos
- Envie `2` para status da assinatura
- Envie `4` para renovar
- Envie `5` para tutoriais
- Envie `6` para teste grátis
- Envie `0` para voltar ao menu

### Teste automático dos flows
Execute:
```bash
node scripts/testFlows.js
```
Isso executa todos os flows simulando contexto, sem WhatsApp real.

### Planos Disponíveis

- **BÁSICO** - R$ 15,00/mês (1 conexão)
- **PREMIUM** - R$ 25,00/mês (2 conexões)
- **FAMÍLIA** - R$ 35,00/mês (3 conexões)
- **VIP** - R$ 50,00/mês (5 conexões)

## 🏗️ Estrutura do Projeto

```
├── app.js                 # Arquivo principal
├── routes.js              # Rotas da API
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente
├── setup.sh               # Script de setup automatizado
├── Dockerfile             # Imagem Docker
├── docker-compose.yml     # Orquestração Docker
├── controllers/
│   └── paymentController.js  # Controle de pagamentos
├── database/
│   ├── database.js        # Classe do banco de dados
│   └── iptv_bot.db        # Banco SQLite (criado automaticamente)
├── flows/                 # Flows modulares (menu, planos, status, etc)
│   ├── mainMenuFlow.js
│   ├── plansFlow.js
│   └── statusFlow.js
├── utils/
│   ├── configLoader.js    # Loader robusto de configs
│   ├── iptvUtils.js       # Utilitários IPTV
│   └── scheduler.js       # Agendador de tarefas
└── whatsapp/
    └── messageHandler.js  # Manipulador de mensagens (roteador de flows)
```

## 🔄 Fluxo de Funcionamento

1. **Cliente envia mensagem** → Bot roteia para o flow correspondente (menu, planos, status)
2. **Cliente escolhe plano** → Bot gera cobrança PIX
3. **Cliente paga PIX** → Webhook notifica o sistema
4. **Sistema processa pagamento** → Credenciais são geradas
5. **Bot envia credenciais** → Cliente recebe acesso IPTV

## 📊 Banco de Dados

O sistema utiliza SQLite com as seguintes tabelas:

- `clientes` - Dados dos clientes
- `assinaturas` - Informações das assinaturas
- `transacoes` - Histórico de pagamentos

## ⚙️ Configuração da PagHiper

1. Acesse sua conta na PagHiper
2. Obtenha seu Token e API Key
3. Configure o webhook para: `https://seu-dominio.com/api/webhook/paghiper`
4. Adicione as credenciais no arquivo `.env`

## 🔧 Integração com Servidor IPTV

Para integração completa com seu servidor IPTV, edite o arquivo `utils/iptvUtils.js`:

```javascript
// Descomente e adapte as funções de API do seu provedor IPTV
async criarUsuarioIPTV(credenciais, plano) {
  const response = await axios.post(`${this.serverUrl}/api/user/create`, {
    username: credenciais.usuario,
    password: credenciais.senha,
    package: plano
  }, {
    headers: {
      'Authorization': `Bearer ${this.apiKey}`
    }
  });
  
  return response.data;
}
```

## 📅 Tarefas Automatizadas

O sistema executa automaticamente:

- **Verificação de vencimentos** - Diariamente às 9h
- **Desativação de assinaturas vencidas** - Diariamente às 10h  
- **Limpeza de transações antigas** - Semanalmente às 2h (segundas)

## 🛠️ Scripts Disponíveis

```bash
npm start     # Inicia o bot em produção
npm run dev   # Inicia em modo desenvolvimento (com nodemon)
```

## 📝 Logs e fallback

- Todos os flows e operações críticas registram eventos via Winston em `logs/app.log`.
- Se um flow não existir, o fallback antigo é chamado e logado.
- Se configs estiverem inválidas, o bot usa valores padrão e loga o erro.
- Logs de testes automáticos também vão para o arquivo.

## 🔒 Segurança

- Credenciais sensíveis em variáveis de ambiente
- Validação de webhooks da PagHiper
- Sanitização de dados de entrada
- Controle de acesso por telefone

## 🆘 Suporte

Para suporte técnico:
- WhatsApp: (11) 99999-9999
- Email: suporte@iptv.com
- Telegram: @suporte_iptv

## 🔄 Deploy, setup e recuperação rápida

- Para rodar localmente: `./setup.sh` (Linux/Mac) ou manualmente (`npm install`, `.env`).
- Para rodar em produção: `docker-compose up --build`.
- O banco SQLite e configs são persistidos em volumes Docker.
- Se perder o banco de dados, basta rodar o setup novamente.
- Se editar configs (`config/messages.json` ou `config/plans.json`), o bot recarrega ao reiniciar.
- Teste flows sem WhatsApp real com `node scripts/testFlows.js`.
- Todos os logs estão em `logs/app.log`.

## 📄 Licença

ISC License

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido com ❤️ para automatizar vendas de IPTV**
