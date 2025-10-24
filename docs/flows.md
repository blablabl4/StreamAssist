# Flows do Bot WhatsApp IPTV

## Visão Geral
Cada comando principal é um módulo em `flows/`. O roteamento é dinâmico via `messageHandler.js`.

## Estrutura do Flow
```js
module.exports = async function(context) {
  // context: { sendMessage, userState, cliente, telefone, texto, messages, logger }
}
```

### Parâmetros do context
- `sendMessage(msg)`: função para enviar mensagem ao usuário
- `userState`: objeto de estado do usuário
- `cliente`: dados do cliente (id, telefone...)
- `telefone`: número do usuário
- `texto`: mensagem recebida
- `messages`: mensagens carregadas da config
- `logger`: instância Winston para logs

## Flows disponíveis

### mainMenuFlow
- Comando: `MENU` ou `0`
- Exibe menu principal
- Exemplo:
```js
await mainMenuFlow({ sendMessage, telefone, userState, messages, logger });
```
- Possíveis erros: Falha ao carregar configs (usa fallback), erro de envio (logado)

### plansFlow
- Comando: `1` ou `PLANOS`
- Mostra planos disponíveis
- Exemplo:
```js
await plansFlow({ sendMessage, telefone, userState, messages, logger });
```

### statusFlow
- Comando: `2` ou `STATUS`
- Mostra status da assinatura
- Exemplo:
```js
await statusFlow({ sendMessage, telefone, userState, cliente, messages, logger });
```

### renewFlow
- Comando: `4` ou `RENOVAR`
- Mostra opções de renovação
- Exemplo:
```js
await renewFlow({ sendMessage, telefone, userState, cliente, messages, logger });
```

### tutorialFlow
- Comando: `5` ou `TUTORIAIS`
- Lista tutoriais de instalação IPTV
- Exemplo:
```js
await tutorialFlow({ sendMessage, telefone, userState, messages, logger });
```

### trialFlow
- Comando: `6` ou `TESTE`
- Gera teste grátis (verifica cooldown)
- Exemplo:
```js
await trialFlow({ sendMessage, telefone, userState, cliente, messages, logger });
```
- Possíveis erros: Cooldown ativo, erro na API de teste (logado)

## Fallback
Se o flow não existir, o handler executa o fluxo antigo e loga o evento.

## Simulação/Teste
```bash
node scripts/testFlows.js
```

## Dependências externas
- PagHiper (pagamentos)
- API IPTV (criação de credenciais, testes)
