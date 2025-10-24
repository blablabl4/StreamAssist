# CI/CD Pipeline IPTV WhatsApp Bot

## Triggers
- Push ou Pull Request na branch `main`.

## Jobs
### lint-and-test
- Instala dependências (`npm ci`)
- Lint do código (`eslint`)
- Validação dos arquivos de config (`messages.json`, `plans.json`) via AJV
- Executa testes automáticos dos flows (`node scripts/testFlows.js`)
- Faz upload dos logs gerados em `logs/app.log`

### docker-build-and-push
- Builda imagem Docker com Buildx
- Faz push para DockerHub (tags: `latest` e SHA do commit)
- Salva imagem como artefato para deploy manual

### deploy
- (Personalizável) Deploy automático ou manual do container em produção
- Exemplo: integração com VPS, Swarm ou Compose
- Notificações via Slack (ou configure Email/GitHub)

## Segredos necessários
- `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN` (para push Docker)
- `SLACK_WEBHOOK_URL` (para notificações Slack)

## Logs e falhas
- Se algum flow falhar nos testes, a pipeline aborta e notifica.
- Logs dos testes e do bot ficam disponíveis como artefato.

## Como interpretar resultados
- Sucesso: imagem Docker publicada, logs disponíveis, deploy liberado
- Falha: verifique logs do job com erro e artefato de logs

## Como simular WhatsApp nos testes?
- Os testes automáticos usam `scripts/testFlows.js`, que simula o contexto de mensagens sem WhatsApp real.

## Como adicionar novos jobs ou steps?
- Edite `.github/workflows/ci-cd.yml` conforme necessário.

---
Para dúvidas ou customizações, consulte os exemplos em `docs/flows.md` e `docs/setup.md`.
