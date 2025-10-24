# Configurações do Bot

## Arquivos
- `config/messages.json`: Mensagens do bot
- `config/plans.json`: Planos IPTV

## Validação
- Validação automática via AJV (schema embutido em utils/configLoader.js)
- Se inválido ou ausente, usa fallback padrão (hardcoded)
- Logs detalhados de erro em logs/app.log

## Exemplo de messages.json
```json
{
  "menu": "Bem-vindo ao IPTV! ...",
  "planos": "Planos: ...",
  "status": "Seu status: ..."
}
```

## Exemplo de plans.json
```json
[
  { "nome": "Básico", "valor": 15, "conexoes": 1 },
  { "nome": "Premium", "valor": 25, "conexoes": 2 }
]
```

## Editando configs
- Edite os arquivos em `config/`
- Reinicie o bot para recarregar

## Restaurando padrão
- Apague o arquivo corrompido ou rode `./setup.sh` para restaurar

## Logs de validação
- Toda falha de validação é registrada no Winston
