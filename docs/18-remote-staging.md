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
`0002-participation-core.sql`, `0003-time-balances.sql`, `0004-operation-budgets.sql` e `0005-retention-rollups.sql`.

O runtime usa `world_pulse_app`, sem SUPERUSER, CREATEDB, CREATEROLE, INHERIT,
BYPASSRLS ou memberships. Conexão pooled com `sslmode=verify-full`.
O proprietário de migrações usa a conexão direta, exclusivamente operacional.
Sua senha foi regenerada somente nessa branch e a conexão atualizada no
GitHub, para não depender da credencial herdada ao criar a branch. A nova
conexão foi autenticada com sucesso. Nenhuma senha da branch main foi alterada.
Foi verificada a recusa efetiva de CREATE TABLE pelo runtime (transação revertida).

## Fonte das credenciais

GitHub Environment **staging** contém `DATABASE_URL` e
`DATABASE_MIGRATION_URL`. Valores não entram em código, issues, screenshots,
logs, argumentos de processos nem bundles do navegador. Todas as conexões
salvas apontam exclusivamente ao endpoint de staging; o usuário runtime foi
criado nessa branch. O proprietário nunca deve ir para o runtime Vercel.

O Environment permite somente `main` e a branch de preparação
`codex/remote-staging`. A checagem manual/push em `infra-staging.yml` usa apenas
`DATABASE_URL`: TLS, colunas migradas, atributos/memberships e negação de DDL.
Não aplica SQL automaticamente. A operação manual `migrate` fornece o proprietário
somente no passo deliberado; o modo `check` usa apenas runtime. Não publica produção.

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

## Evidência

[Actions 40049427842](https://github.com/Faysk/world-pulse/actions/runs/40049427842):
17 testes de infraestrutura aprovados e verificação ao vivo do banco de staging
aprovada usando a secret do GitHub, em 24/10/2026.

O preview do PR #55 foi recusado pela Vercel com `build-rate-limit` e orientação
de aguardar 24 horas. Nenhum upgrade foi solicitado. Isso bloqueia a validação
do preview HTTPS, mas não a preparação nem a checagem remota do banco.


## Atualização do staging — 24/10/2026

A migração 0004 foi aplicada via Actions no run 40051933404, que detectou depois
que o pooler não preservava timeouts de startup. A API agora aplica SET LOCAL
dentro de cada transação. [Run 40052178137](https://github.com/Faysk/world-pulse/actions/runs/40052178137)
aprovou TLS, schema com orçamentos, timeouts efetivos no pooler, role restrita e
negação de DDL. Nenhuma credencial foi trazida de volta do GitHub para a máquina.
Staging HTTPS pela Vercel continua sendo uma validação distinta pendente.


Migração 0005 aplicada no staging via [run 40053116588](https://github.com/Faysk/world-pulse/actions/runs/40053116588), incluindo checagem de schema e timeouts. `maintain` é operação manual limitada, somente runtime, para a política de [retenção](27-retention-policy.md). Produção não foi migrada nem agendada.
