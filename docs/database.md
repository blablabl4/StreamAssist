# Banco de Dados SQLite

## Localização
- `database/iptv_bot.db`

## Tabelas principais
- `clientes` (id, telefone, nome, data_cadastro, status)
- `assinaturas` (id, cliente_id, plano, data_inicio, data_fim, status)
- `transacoes` (id, cliente_id, valor, status, data, tipo)

## Inicialização
- Automática via `setup.sh` ou ao rodar o bot
- Scripts de criação em `database/database.js`

## Persistência
- Docker: volume persiste banco mesmo após rebuild
- Backup manual: copie o arquivo `.db`

## Exemplos de queries
```sql
SELECT * FROM clientes WHERE telefone = '11999999999';
SELECT * FROM assinaturas WHERE cliente_id = 1;
```

## Recomendações
- Não edite o banco manualmente
- Use scripts utilitários para manutenção
