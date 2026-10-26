# 18 — Staging remoto de participação

Issues [#53](https://github.com/Faysk/world-pulse/issues/53) e [#134](https://github.com/Faysk/world-pulse/issues/134), milestone v0.4. Atualizado em 26/10/2026.

## Banco preparado em 24/10/2026

Neon Free, projeto existente `world-pulse-production`, região Londres. O nome
do projeto contém production, mas o staging usa uma branch própria:

| Ambiente | Branch Neon | Dados |
|---|---|---|
| Produção | `main` / `br-long-mountain-zaoh0284` | Não alterados por esta preparação |
| Staging | `world-pulse-staging` / `br-empty-salad-zajkrqf8` | Schema-only, sem copiar linhas da produção |

Em 26/10/2026 a expiração automática foi removida pelo painel Neon. A branch
continua isolada e schema-only; não houve cópia de dados nem upgrade de plano.
O endpoint fixado, roles e TLS continuam obrigatórios. O antigo prazo de
31/10/2026 não deve bloquear operações sobre uma branch que agora é persistente.

Aplicadas somente no staging: `0001-runtime-access.sql`,
`0002-participation-core.sql`, `0003-time-balances.sql`, `0004-operation-budgets.sql`,
`0005-retention-rollups.sql`, `0006-country-geography.sql`, `0007-regional-points.sql`
e `0008-one-km-regions.sql`. Produção também está na versão 0008.

O runtime usa `world_pulse_app`, sem SUPERUSER, CREATEDB, CREATEROLE, INHERIT,
BYPASSRLS ou memberships. Conexão pooled com `sslmode=verify-full`.
O proprietário de migrações usa a conexão direta, exclusivamente operacional.
Sua senha foi regenerada somente nessa branch e a conexão atualizada no
GitHub, para não depender da credencial herdada ao criar a branch. A nova
conexão foi autenticada com sucesso. Nenhuma senha da branch main foi alterada.
Foi verificada a recusa efetiva de CREATE TABLE pelo runtime (transação revertida).

## Fonte das credenciais

GitHub Environment **staging** contém `DATABASE_URL`, `DATABASE_MIGRATION_URL`
e `VERCEL_TOKEN`. O token Vercel foi renovado em 26/10/2026, limitado ao projeto
`world-pulse`, com vencimento em 24/01/2027. A variável
`WP_PREVIEW_TOKEN_EXPIRES_AT` registra o prazo conservador; o check diário exige
renovação com antecedência de sete dias. Valores secretos não entram em código, issues, screenshots,
logs, argumentos de processos nem bundles do navegador. Todas as conexões
salvas apontam exclusivamente ao endpoint de staging; o usuário runtime foi
criado nessa branch. O proprietário nunca deve ir para o runtime Vercel.

O Environment permite somente `main` e a branch de preparação
`codex/remote-staging`. A checagem manual/push em `infra-staging.yml` usa apenas
`DATABASE_URL`: TLS, colunas migradas, atributos/memberships e negação de DDL.
Não aplica SQL automaticamente. A operação manual `migrate` fornece o proprietário
somente no passo deliberado; o modo `check` usa apenas runtime. Não publica produção.

`infra/staging-db.mjs` fixa endpoint, banco, roles e TLS, rejeitando parâmetros
sslmode duplicados. Operações
exigem `WP_STAGING_OPERATION=check` ou `migrate`; o modo migrate deve receber
as duas conexões de staging no ambiente do processo. Os erros privados dos
drivers são suprimidos.

## Estado da entrega

- O workflow `infra-preview.yml` sincroniza somente runtime de staging e publica
  preview vinculado a `codex/remote-staging`, sem promover produção.
- Testa HTTPS/API e revoga o acesso temporário depois do smoke. O smoke de dois
  navegadores com banco remoto é uma operação separada em `infra-staging.yml`.
- Produção está ativa; o mapa público não contém participantes simulados.
- A experiência integrada usa gates explícitos; o laboratório antigo continua DEV-only.

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

Migração 0006 (consentimento de país e cache agregado) aplicada somente no staging: [40058318799](https://github.com/Faysk/world-pulse/actions/runs/40058318799). Check após migração: [40058318548](https://github.com/Faysk/world-pulse/actions/runs/40058318548). Os gates de origem geográfica continuam desligados. Fluxo preparado de [plano/sync de preview](32-prepublication-operations.md) não publica.

Homologação HTTPS privada contra o Neon staging real aprovada em [40061344573](https://github.com/Faysk/world-pulse/actions/runs/40061344573): desktop/mobile, duas sessões, cookies seguros, retorno, múltiplos saldos, perda de resposta/retry e consentimento desconhecido; quatro sessões sintéticas removidas no encerramento. Tags vazias/contadores de teste podem permanecer, sem dados copiados da produção. Não comprova certificado/headers/runtime Vercel. [Método e limites](35-staging-private-https-smoke.md).

## Quota revalidada — 25/10/2026

Um novo preview do commit 88fe0b4 terminou READY e seu HTML respondeu 200 em HTTPS,
com proteção preservada. O bloqueio de build não se repetiu. Check Neon
40229816651 e plano preview 40229862494 aprovados. A validação de banco/aplicativo
na Vercel ainda depende do token próprio do staging e sincronização deliberada;
esse preview não usa a conexão de produção. [Registro atual](36-prepublication-status.md).

O token próprio de staging foi criado e salvo no GitHub em 25/10, com acesso
somente ao projeto world-pulse e validade até 01/11. A sincronização de preview
[40230733906](https://github.com/Faysk/world-pulse/actions/runs/40230733906) passou.
Esse recibo histórico foi superado: fonte de país ativada posteriormente,
expiração automática removida e token renovado em 26/10; ver estado atual no topo.
