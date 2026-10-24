# Operações preparadas antes da publicação

Este documento descreve código pronto para revisão e execução deliberada, não
afirma ativação de produção. Publicação está pausada. Integrar o código do PR #31 não publica nem ativa a API.

## Preview separado

`infra-preview.yml` só roda manualmente em `codex/remote-staging`, usando o
Environment `staging`. `plan` confere o schema/permissões do Neon e descreve
somente nomes das variáveis, branch e destino. Não chama a Vercel. A operação
`preview-plan` do workflow já registrado `Staging database` permite validar esse
plano antes de o novo workflow existir na branch principal.

`sync` exige `WP_PREVIEW_SYNC_ENABLED=true` no Environment staging e um
`VERCEL_TOKEN` próprio nesse Environment. A ausência mantém a operação bloqueada.
O token está pendente; não é possível recuperar o valor da secret de produção,
e esse processo não deve fazê-lo. Não criar nem ampliar credenciais apenas para
contornar a pausa na publicação.

O código fixa projeto/equipe e restringe as seis variáveis ao destino `preview`
e à branch `codex/remote-staging`. `DATABASE_URL` é sensitive e só aceita o
runtime pooled da branch Neon temporária, com TLS verify-full. Owner é proibido.
Não sincroniza R2, credencial de migração nem token ao aplicativo. A expiração
do staging em **31/10/2026 01:15:25 UTC** bloqueia plano e sincronização até que
um novo staging revisado substitua os identificadores fixos e as secrets.

A API, UI e leitura agregada podem funcionar nesse preview; captura do país
fica explicitamente desativada até validar a borda. O plano não ativa nada e a
sincronização não publica: as variáveis só se aplicam a um novo deployment.
Não existe endpoint de deploy, promoção ou alteração de domínio nesse fluxo.
Referências do provedor: [escopo por branch](https://vercel.com/docs/environment-variables/manage-across-environments)
e [variáveis sensitive](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

## Retenção monitorada

`infra-retention.yml` prepara execução horária via Actions e operação manual
`plan`/`maintain`, exclusivamente `main` e Environment production. **Desativado**
até a variável **do repositório** `WP_RETENTION_ENABLED=true`. Mantê-la ausente
ou false enquanto não houver liberação. A condição de agendamento é avaliada
antes de carregar o Environment; não configurar essa chave apenas nele.

Antes de qualquer leitura/execução, `WP_PRODUCTION_DB_HOST` no Environment
production precisa conter o hostname pooled real, conferido no provedor. Ainda
não foi atestado/configurado neste trabalho. O validador rejeita staging,
proprietário, banco/porta diferentes e TLS fraco. O script confirma que o runtime
não tem atributos elevados ou memberships. Não fornece o owner ao job.

`plan` usa uma transação READ ONLY e informa apenas contagem elegível limitada a
10.000. `capped=true` significa **pelo menos** esse número. `maintain` exige a
flag, consolida até 100 sessões por transação, no máximo 50 lotes e 50 segundos
entre lotes. Uma transação em andamento tem seus próprios timeouts; não é
interrompida parcialmente pelo relógio do loop. O limite não é promessa de vazão.

Cada execução produz resumo de horário, elegíveis antes/depois, lotes e total
consolidado, sem IDs, IPs ou conexões. Backlog restante falha o job para exigir
revisão/retry. O agendamento Actions pode atrasar ou ser desabilitado por
inatividade: o responsável deve conferir falhas, ausência de runs e backlog;
não se deve anunciar retenção cumprida só porque o cron existe. A configuração
de notificações do GitHub é pessoal e não foi alterada. Backups/logs do provedor
têm ciclos próprios ainda sujeitos à verificação operacional.

Para interromper: definir a variável do repositório como false e cancelar runs
em andamento se necessário. Rollups já confirmados são irreversíveis no nível
da identidade individual por projeto: não resta vínculo para restaurar aquela
sessão. A política já foi autorizada; a ativação operacional ainda depende da
liberação e migração de produção.

## Sequência quando a publicação for destravada

1. Conferir validade do staging/token e o commit exato com todos os checks verdes.
2. Validar plano e, após liberação, sincronizar somente o preview aprovado.
3. Publicar preview protegido e testar HTTPS real: cookie Secure/HttpOnly,
   duas sessões/abas, retries após resposta perdida, retorno e vários saldos.
4. Testar fonte de país no trajeto real, VPN/proxy/desconhecido, consentimento e
   retirada. Só então considerar atestações da borda; nunca ativar por suposição.
5. Conferir planos gratuitos, métricas de requisições/CPU/Neon, políticas de
   backups/logs e aviso de privacidade. Medir hardware físico, não apenas emulação.
6. Revisar e aplicar 0002–0006 em produção em operação própria, com owner apenas
   operacional; não há migração automática no deploy. Conferir restore/rollback
   do provedor antes de iniciar participação. Não apagar tabelas para rollback.
7. Conferir hostname de produção, executar plano de retenção, ativar a rotina
   deliberadamente e verificar a primeira execução. Documentar responsável e
   acompanhamento de backlog/ausência de runs.
8. Liberar em mudança deliberada as variáveis do Environment production
   `WP_ALPHA_RELEASE=true` e `WP_API_ENABLED=true`, mantendo geografia desligada
   até seu gate separado. O sync sincroniza valores literais e rejeita combinações
   inconsistentes. Um novo build é necessário. Sem essas flags, produção preserva
   a demonstração e nem query string nem a flag de preview podem ativar a alpha.
9. Usar o fluxo de candidato isolado → smoke → revogar acesso temporário → promover,
   seguido de smoke do domínio. Em incidente, desligar API/geografia e reimplantar
   o commit estável; manter banco/histórico para investigação, sem DELETE/CASCADE.

Pendências reais: #53 (HTTPS), #6 (fonte), #7 (custo), #12/#32 (hardware/visual) e
#13 (alpha). Não fechar esses gates por testes locais ou por preparação operacional.

## Gate de build da alpha (#77)

O build com VERCEL_ENV=production e WP_ALPHA_RELEASE=true monta a experiência na raiz, sem parâmetro de laboratório. Essa flag é distinta da autorização da API. Os três builds compilados são testados: produção fechada, preview com opt-in e alpha deliberada com API indisponível para verificar falha explícita. Nenhuma flag foi ativada nem sincronizada neste trabalho. Reverter WP_ALPHA_RELEASE/WP_API_ENABLED para false e reconstruir volta à demonstração; envs já publicadas não mudam sem redeploy. A leitura geográfica tem gate independente.
