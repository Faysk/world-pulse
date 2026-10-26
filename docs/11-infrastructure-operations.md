# 11 — Infraestrutura e operações

**Atualizado em 26/10/2026.** Rastreio: #7, #15, #16, #17 e #18.

## Serviços e estado real

| Componente | Recurso | Estado |
|---|---|---|
| Hospedagem | Vercel Hobby, projeto `world-pulse` | Projeto existente reutilizado |
| Domínio | `map.faysk.dev` | CNAME e TXT criados na Cloudflare; propriedade validada pela Vercel |
| Banco | Neon Free, `world-pulse-production`, Londres | Provisionado pelo Vercel Marketplace; runtime configurado pelo GitHub; `SELECT 1` com TLS validado |
| Objetos | R2 Standard, `world-pulse-production` | Privado; teste de escrita/leitura/remoção validado |
| Credenciais | GitHub Environment `production` | Credenciais de banco e R2 armazenadas; deploy permitido somente na branch `main` |
| App | React/Vite/MapLibre em `main` | Alpha/API e pontos regionais ativos; país só nos resumos |

O domínio responde com a alpha funcional desde 25/10/2026. Migrações e runtime
verificados, retenção ativa, candidato testado/promovido e conferência pública
aprovada. [Primeira alpha](39-production-alpha-release.md) e [taps/país: estado atual](40-fluid-taps-country-choice.md).

## Banco e limites

Neon Free fornece PostgreSQL separado em Londres. A aplicação acessa o banco por
API server-side com role runtime restrita; a credencial de migração permanece
separada. Não usamos serviços externos de Auth/Realtime. Migrações 0001–0007 foram aplicadas/verificadas em produção; futuras mudanças
continuam manuais e separadas do deploy.

Planos/quotas devem ser conferidos nos painéis e nas fontes oficiais: [Neon](https://neon.com/pricing),
[R2](https://developers.cloudflare.com/r2/pricing/) e [Vercel Hobby](https://vercel.com/docs/plans/hobby).
Provisionar em plano gratuito não garante custo zero em qualquer volume.

## GitHub como fonte operacional

Segredos ficam em **Settings → Environments → production → Environment secrets**. GitHub não permite reler seus valores depois de gravados. Para rotacionar, gerar valor novo no provedor, substituir o secret e executar `sync`, seguido de novo deploy. Não colocar valores em issues, PRs, arquivos versionados, outputs ou artefatos do Actions.

| Nome | Local no GitHub | Destino/uso |
|---|---|---|
| `DATABASE_URL` | Secret de `production` | PostgreSQL com `sslmode=verify-full`; exclusivamente servidor |
| `DATABASE_MIGRATION_URL` | Secret de `production` | Proprietário para migrations; nunca enviado ao runtime |
| `R2_ACCESS_KEY_ID` | Secret de `production` | S3, limitado ao bucket do projeto |
| `R2_SECRET_ACCESS_KEY` | Secret de `production` | S3, limitado ao bucket do projeto |
| `VERCEL_TOKEN` | Secret de `production` | Somente Actions; escopo `world-pulse`, expira em 21/01/2027 |
| `VERCEL_ORG_ID` | Repository variable | ID da equipe Vercel |
| `VERCEL_PROJECT_ID` | Repository variable | ID do projeto Vercel |
| `APP_URL` | Repository variable | `https://map.faysk.dev` |
| `R2_ACCOUNT_ID` | Variable de `production` | Conta Cloudflare |
| `R2_BUCKET_NAME` | Variable de `production` | `world-pulse-production` |

`GITHUB_TOKEN` é fornecido pelo próprio Actions; não criar PAT para o pipeline. Tokens administrativos da Cloudflare, credenciais de outros projetos e credenciais de login pessoal não são necessários ao runtime.

O Marketplace injeta variáveis de conexão do banco na Vercel. A sincronização do GitHub gerencia explicitamente `DATABASE_URL`, as duas chaves R2, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` e `APP_URL` em **production**. Não sincroniza tokens de controle nem credenciais para Preview/Development. `DATABASE_URL` usa o papel `world_pulse_app`, sem permissão de criar objetos nos schemas `public` e `world_pulse`. A URL de proprietário fica separada em `DATABASE_MIGRATION_URL` no GitHub. A base de permissões está em `infra/sql/0001-runtime-access.sql`; migrations de domínio devem usar o mesmo proprietário e o schema `world_pulse` para herdar os grants de DML. Variáveis auxiliares de proprietário injetadas pelo Marketplace foram removidas ao desconectar a integração do projeto, mantendo o recurso Neon existente. Uma sincronização posterior confirmou somente as seis variáveis runtime na Vercel. O painel de Storage pode mostrar o recurso sem projetos conectados: isso é esperado, pois a conexão SQL é gerenciada pelo GitHub Actions.

## Workflows

### Infrastructure CI

Executa em PRs e mudanças de infraestrutura em `main`, sem secrets. Instala o lockfile de `infra/`, roda testes de configuração e auditoria de dependências. Actions estão fixadas por SHA; dependências por versão exata. Complementa o workflow Visual POC CI do frontend.

### Production infrastructure

Executar em **Actions → Production infrastructure → Run workflow**, branch `main`:

- `check`: conecta ao banco, executa uma consulta em transação somente leitura e testa um objeto sintético em `_infra-check/<uuid>.txt` no R2. Tenta removê-lo no encerramento, inclusive em falhas. O lifecycle `expire-infrastructure-probes` remove resíduos exclusivamente em `_infra-check/` após um dia.
- `sync`: executa `check` e copia somente a lista explícita de variáveis runtime para a Vercel. Secrets são gravados como `sensitive`; configurações não secretas como `plain`. A resposta da API nunca é impressa.
- `deploy`: executa `check` e `sync`, solicita build remoto do commit exato de `main` com configuração de produção e `autoAssignCustomDomains=false`. Após READY, verifica HTML e bundles JS/CSS na URL candidata, revoga acesso temporário e promove a mesma versão. Confirma o deployment ativo no projeto e repete o smoke no domínio público. Não executa migrations automaticamente.

Antes de `deploy`, um job separado **sem production secrets** exige o app e `package-lock.json` versionados, executa `npm ci`, `npm test` e `npm run build`. Se falhar, o job de infraestrutura não inicia. Operações `check` e `sync` não dependem de haver frontend em `main`. O smoke da candidata valida entrega de HTML/JS/CSS, rejeita login, redirecionamento externo e assets quebrados; não substitui o smoke gráfico do CI nem benchmark em dispositivo físico.

A candidata protegida usa uma shareable link restrita àquele deployment, com TTL de 600 segundos, criada e revogada pela API durante a operação. O token fica somente na memória do processo, nunca é impresso nem enviado para outros hosts. Mesmo se o runner for interrompido antes da revogação, o acesso expira pelo TTL. A proteção geral do projeto permanece habilitada. O smoke completo da candidata permite no máximo quatro tentativas, com intervalo de dois segundos. Se teste ou revogação falhar, a promoção não é solicitada. Logs mostram etapas fixas, status HTTP e erros do próprio smoke; nunca respostas privadas do provedor. Falha depois da promoção é reportada, mas não faz rollback automático; usar o deployment anterior no painel Vercel para recuperação deliberada.

Deploy de produção é manual para não publicar um frontend em rascunho. `vercel.json` desativa deploys automáticos em `main` e `infra/*`; produção passa pelo Actions. Branches de frontend podem continuar gerando previews sem secrets de produção. O pipeline usa a integração Git da Vercel para buscar o commit, portanto o GitHub App da Vercel precisa continuar autorizado no repositório. Preservar esse bloco `git` ao alterar as opções de build Vite.

Produção tem restrição de branch `main`, mas não foi configurada revisão humana obrigatória nem proteção da branch principal. Alterações em `main` continuam exigindo confiança nos mantenedores. Não usar `pull_request_target` nem rodar PRs com secrets.

## DNS e HTTPS

| Tipo | Nome | Valor | Proxy |
|---|---|---|---|
| CNAME | `map` | `a7412babbdcea338.vercel-dns-017.com` | DNS only |
| TXT | `_vercel` | Desafio `vc-domain-verify=map.faysk.dev,…` retornado pela Vercel | DNS only |

Manter outros TXT `_vercel` existentes: pertencem a outros projetos. A Vercel emite o certificado; Cloudflare administra DNS. Não habilitar proxy sem testar geolocalização e cache. Nenhum outro domínio foi alterado.

## Desenvolvimento local e diagnóstico

Requisitos: Node 22+; CI usa Node 24. Credenciais locais vão em `.env.local`, ignorado pelo Git. `.env.example` contém apenas nomes e IDs não secretos. Nenhuma ferramenta de frontend recebe as chaves; nunca criar variáveis `VITE_*` ou `NEXT_PUBLIC_*` com segredos.

```powershell
npm ci --prefix infra --ignore-scripts
npm test --prefix infra
node --env-file=.env.local infra/check-connections.mjs
```

Falha de configuração: comparar nomes com `.env.example`; não imprimir valores. Falha SQL: verificar estado/escala a zero do Neon, TLS e permissões. Falha S3: conferir escopo do token e bucket privado. Falha de sync: conferir validade e escopo do token Vercel. Falha de deploy: verificar existência do app em `main`, build remoto, commit, DNS e HTTP. HTTP 200 não prova funcionamento de banco ou do globo no navegador; a integração da aplicação segue nas issues de produto.

## Próximas entregas de produto

Esta configuração valida conectividade, não implementa hashtags, sessões, lotes idempotentes ou presença. A API experimental do PR #31 ainda precisa cumprir o contrato de saldo e as decisões de privacidade/retenção antes de ativação. Implementar API com credencial SQL restrita, validação e lotes; nunca conectar o navegador diretamente ao Postgres ou expor o bucket. O contrato de saldo (#9) já está confirmado; falta implementá-lo no banco/API e integrar o cliente.



Pontos regionais: [migração 0007, fonte, autorização e recibos](42-regional-participation-points.md). As coordenadas exatas não são recebidas pelo servidor.
