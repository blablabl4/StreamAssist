# Setup e Instalação

## Pré-requisitos
- Node.js 16+
- npm ou yarn
- Docker e docker-compose (opcional, recomendado para produção)

## Instalação Local
```bash
git clone <repo>
cd Ziel
npm install
cp .env.example .env # Configure variáveis de ambiente
```

## Setup Automatizado
```bash
./setup.sh
```
- Instala dependências
- Cria banco SQLite e popula configs padrão

## Rodando o Bot
```bash
npm start
```

## Docker (Produção)
```bash
docker-compose up --build
```
- Banco e configs persistidos em volumes
- Logs em logs/app.log

## Testes de flows
```bash
node scripts/testFlows.js
```

## Estrutura de Pastas
```
config/      # messages.json, plans.json
flows/       # mainMenuFlow.js, ...
utils/       # configLoader.js, logger
whatsapp/    # messageHandler.js
controllers/ # paymentController.js
scripts/     # setup.sh, testFlows.js
```
