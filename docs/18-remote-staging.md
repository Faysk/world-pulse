# 18 — Staging remoto de participação

Issue [#53](https://github.com/Faysk/world-pulse/issues/53), milestone v0.3.

## Banco preparado em 24/10/2026

Neon Free, projeto existente `world-pulse-production`, região Londres. O nome
do projeto contém production, mas o staging usa uma branch própria:

| Ambiente | Branch Neon | Dados |
|---|---|---|
| Produção | `main` / `br-long-mountain-zaoh0284` | Não alterados por esta preparação |
| Staging | `world-pulse-staging` / `br-empty-salad-zajkrqf8` | Schema-only, sem copiar linhas da produção |

O staging expira automaticamente em **31/10/2026 às 01:15 UTC**. É um ambiente
remoto temporário para homologação, não uma dependência permanente do produto.
O script recusa operações após essa data; renovar/recriar exige atualizar o
destino fixado, as credenciais e a documentação. Não houve upgrade de plano.

Aplicadas somente no staging: `0001-runtime-access.sql`,
`0002-participation-core.sql`, `0003-time-balances.sql`.

O runtime usa `world_pulse_app`, sem SUPERUSER, CREATEDB, CREATEROLE, INHERIT,
BYPASSRLS ou memberships. Conexão pooled com `sslmode=verify-full`.
O proprietário de migrações usa a conexão direta, exclusivamente operacional.
Foi verificada a recusa efetiva de CREATE TABLE pelo runtime (transação revertida).

## Fonte das credenciais

GitHub Environment **staging** contém `DATABASE_URL` e
`DATABASE_MIGRATION_URL`. Valores não entram em código, issues, screenshots,
logs, argumentos de processos nem bundles do navegador. Nenhuma credencial
de produção foi copiada para o staging. O proprietário nunca deve ir para o
runtime Vercel.

O Environment permite somente `main` e a branch de preparação
`codex/remote-staging`. A checagem manual/push em `infra-staging.yml` usa apenas
`DATABASE_URL`: TLS, colunas migradas, atributos/memberships e negação de DDL.
Não aplica SQL automaticamente, não usa o proprietário e não publica produção.

`infra/staging-db.mjs` fixa endpoint, banco, roles, TLS e expiração. Operações
exigem `WP_STAGING_OPERATION=check` ou `migrate`; o modo migrate deve receber
as duas conexões de staging no ambiente do processo. Os erros privados dos
drivers são suprimidos.

## Ainda pendente

- Configurar somente um preview Vercel aprovado com a conexão runtime de staging.
- Automatizar sincronização GitHub → preview e validar sessão/retorno/retry
  pelo HTTPS remoto em dois navegadores.
- O laboratório atual é DEV-only; ainda não aparece em builds de preview.
- `WP_API_ENABLED` continua desligado em produção; o mapa permanece sintético.

O banco pronto e a checagem verde não equivalem a uma release pública da API.
