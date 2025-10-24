# Contribuição e Boas Práticas

## Naming conventions
- Flows: `nomeFlow.js` (ex: statusFlow.js)
- Funções: camelCase
- Variáveis: camelCase
- Configs: snake_case para chaves JSON

## Estilo de código
- Use async/await
- Sempre trate erros e logue com Winston
- Separe lógica de fluxo (flows/) da de integração (utils/, controllers/)
- Mantenha configs externas em `config/`

## Commits
- Mensagens claras e descritivas
- Use prefixos: feat, fix, refactor, docs, chore

## Testes
- Teste flows com `scripts/testFlows.js`
- Adicione exemplos de contexto simulado

## Adicionando novos flows
- Crie um novo arquivo em `flows/`
- Exporte uma função async padrão
- Atualize o roteamento no handler se necessário

## Pull Requests
- Descreva claramente a motivação
- Relacione issues/bugs
- Inclua exemplos de uso/teste
