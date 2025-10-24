# Logger Winston

## Configuração
- Configurado em `utils/configLoader.js`
- Logs estruturados em JSON
- Níveis: info, warn, error
- Logs em console e arquivo: `logs/app.log`

## Exemplos de eventos logados
- Recebimento de mensagem
- Execução de flow
- Fallback para fluxo antigo
- Erros de integração (PagHiper, IPTV)
- Falhas de validação de configs
- Execução de testes automáticos

## Interpretando logs
```json
{"level":"info","event":"route_flow","flow":"status","telefone":"11999999999"}
{"level":"error","event":"erro_test_flow","flow":"trial","error":"Cooldown ativo"}
```
- Use os logs para rastrear execuções, erros e comportamento do bot

## Logs de pagamento
- Toda tentativa de cobrança é logada com status
- Falhas de integração com PagHiper são detalhadas

## Onde encontrar
- `logs/app.log` (persistente)
- Console (execução local/dev)
