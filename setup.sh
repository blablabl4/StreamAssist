#!/bin/bash
# setup.sh - Inicialização do ambiente do IPTV Bot

set -e

echo "[SETUP] Instalando dependências Node.js..."
npm install

echo "[SETUP] Verificando variáveis essenciais (.env)..."
if [ ! -f .env ]; then
  echo "ERRO: Arquivo .env não encontrado. Crie um .env com as chaves necessárias."
  exit 1
fi

REQUIRED_VARS=(PAGHIPER_API_KEY PAGHIPER_TOKEN IPTV_SERVER_URL WEBHOOK_BASE_URL PORT)
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^$var=" .env; then
    echo "ERRO: Variável $var não encontrada no .env."
    exit 1
  fi
done

echo "[SETUP] Inicializando banco de dados (se necessário)..."
node -e "require('./database/database').init && require('./database/database').init()"

echo "[SETUP] Pronto! Ambiente inicializado com sucesso."
