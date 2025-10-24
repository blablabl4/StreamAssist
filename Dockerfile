# Dockerfile para IPTV Bot (Node.js)
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Cria diretório para logs
RUN mkdir -p /app/logs

# Expor porta padrão (ajuste conforme .env)
EXPOSE 3000

CMD ["npm", "start"]
