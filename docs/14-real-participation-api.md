# 14 — API experimental de participação real (revisão técnica, NÃO lançada)

**Branch:** `feat/real-participation-api` · **Estado:** implementação isolada, sem migração executada, sem exposição no globo público. **API bloqueada por padrão:** exige variável exclusivamente server-side `WP_API_ENABLED=true`, ausente nos ambientes atuais.

## Objetivo

Validar duas sessões distintas num backend PostgreSQL existente (Neon) antes de integrar geografia, presença ou ranking de atividade em tempo real. A POC visual atual **não foi alterada**: seus pontos e contadores continuam simulados.

## Gate de lançamento — desligado por padrão

Todas as rotas HTTP deste PR devolvem `503 participation_disabled` se `WP_API_ENABLED` **não** for exatamente `true`. A variável deve ser configurada **somente** no runtime Vercel, nunca como `VITE_*` ou código no navegador, e **somente depois** de aprovar migração, retenção, segurança e política de presença/privacidade.

A release visual em `map.faysk.dev` continua usando exclusivamente dados sintéticos. A mera presença dos arquivos `api/*.mjs` na build não autoriza nem ativa a participação real.

## Contrato HTTP (mesma origem, JSON)

Todas as rotas de escrita exigem `Origin` exatamente igual ao host da aplicação (HTTPS fora do dev local). Não há CORS para outros domínios.

| Rota | Método | Corpo | Retorno |
|---|---|---|---|
| `/api/session` | POST | `{}` | Cookie `wp_session` seguro/HttpOnly/SameSite=Lax, `activeTagId`, `credits[]` |
| `/api/tags` | POST | `{"name":"#GTA6"}` | `{"tag":{"id":"uuid","name":"#gta6","color":"#rrggbb"}}` |
| `/api/select` | POST | `{"tagId":"uuid"}` (ou null) | `{"activeTagId":"uuid"}` |
| `/api/taps` | POST | `{"batchId":"uuid","tagId":"uuid","clicks":1}` | `{"batchId":"uuid","tagId":"uuid","acceptedClicks":1,"duplicate":false,"creditedSeconds":"1"}` |
| `/api/ranking` | GET | — | `{"type":"historical","ranking":[{"id","name","color","historicalParticipants":"…","creditedSeconds":"…"}]}` |

### Regras importantes

1. O cookie tem 256 bits aleatórios; no banco entra **somente SHA-256 do token**. Visitante aqui é **navegador pseudônimo**, não uma pessoa física comprovada. Sem fingerprint e sem login.
2. Nome de hashtag passa por NFKC, lower-case e validação de 2–32 caracteres (`\p{L}`, `\p{N}`, `_`). Prefixo `#` opcional, removido do identificador canônico.
3. A primeira inserção atribui uma cor aleatória hex RGB, armazenada no banco e idêntica em consultas futuras; `ON CONFLICT DO NOTHING` conserva a cor original.
4. `/api/select` permite **uma seleção ativa por sessão**. Uma nova hashtag só pode receber segundos se já tiver sido selecionada ao menos uma vez.
5. `/api/taps` aceita 1–30 toques declarados, exige `batchId` UUID e impõe limite básico de 120 créditos/minuto/sessão (não é defesa antifraude robusta).
6. Idempotência em `(visitor_id,batch_id)`: enviar de novo conteúdo idêntico retorna `duplicate=true` e `acceptedClicks=0`; conteúdo diferente com mesmo ID recebe HTTP 409.
7. Um lote de A pode chegar **depois** da troca para B se A já foi selecionada. Ao aceitar um lote novo, o servidor estende o saldo de A, sem alterar `active_tag_id`. Retry duplicado não altera saldo nem histórico. A janela de aceitação de lotes atrasados ainda depende da política de retenção antes da ativação pública.
8. `creditedSeconds` é histórico de taps. O saldo cronológico é separado: `expires_at = max(expires_at, statement_timestamp()) + clicks segundos`, atualizado uma única vez por lote. O relógio é consultado na instrução de crédito, depois do lock por visitante. Fechar a aba ou selecionar outra hashtag não pausa nem apaga o saldo.
9. `/api/ranking` usa **métrica histórica declarada**, não presença ativa, não densidade geográfica e não a contagem mundial de pessoas físicas. Valores de segundos são strings decimais para evitar overflow de bigint no JavaScript.
10. Nenhum dado de IP, localização GPS, user-agent ou coordenada vai para este modelo. A região aparece como `unknown` conceitualmente até a decisão de #6. **Não mostrar os agregados no globo ainda.**

## Saldo cronológico e retorno à sessão — correção #39

`/api/taps` e cada item de `credits[]` em `/api/session` retornam:

- `tagId` e `creditedSeconds` (string decimal para histórico bigint);
- `expiresAtMs`: timestamp de expiração em milissegundos;
- `serverNowMs`: relógio do servidor usado para o snapshot;
- `remainingMs`: máximo de zero e diferença entre os timestamps.

Exemplo: saldo ainda válido de oito horas recebe três taps → a expiração aumenta
três segundos; o mesmo lote repetido não aumenta novamente. Depois de expirar,
dois taps novos criam dois segundos a partir do relógio do servidor, preservando
o histórico. Vários pares podem ter saldo simultaneamente.

O frontend futuro deve animar o saldo pelo tempo monotônico decorrido desde a
recepção e reconciliar com snapshots, sem assumir relógios de browser/servidor
iguais. O transporte guarda snapshots; ele ainda não desenha esse contador.

A migração `0003-time-balances.sql` acrescenta a expiração com valor inicial já
expirado, preservando créditos antigos sem inventar participação ativa. Executar
manualmente depois de `0002`; o CI testa ambas em banco descartável. Nenhuma das
duas foi aplicada no Neon de produção.

## Laboratório de integração

O [laboratório isolado](17-isolated-participation.md) conecta interface, cookie,
handlers e PostgreSQL descartável no CI. Só abre em desenvolvimento com
`participationPreview=1`; não altera participantes do globo nem ativa produção.
O transporte usa o relógio monotônico de cada snapshot para não pausar saldos
anteriores quando outra hashtag recebe taps. Os snapshots privados também
retornam nome/cor da hashtag para restaurar a interface sem IDs visíveis.

## Cliente experimental, separado do globo público

O módulo [`src/participationClient.ts`](../src/participationClient.ts) implementa o transporte da próxima etapa de frontend:

- `connect()`: sessão anônima e cookie HttpOnly; restaura seleção e snapshots de saldo pelo servidor. `balances()` devolve cópias desses snapshots.
- `selectTag(name)`: cria/resgata um # e seleciona-o em sequência; mudanças rápidas são serializadas.
- `creditClick()`: **somente** quando um evento de usuário válido o chamar; acumula em memória e `localStorage` usando lotes de até 30.
- `flush()`: transmite lotes com `batchId` e conteúdo estáveis. Lotes enviados ou restaurados ficam congelados; taps novos recebem outro lote. Uma resposta perdida não permite alterar o payload do ID antigo. A fila só remove um lote depois de confirmação.
- `clearSelection()`: desativa o #; `ranking()`: consulta exclusivamente participação histórica.
- A fila local não armazena cookie, token ou coordenadas; **não é um armazenamento durável garantido** (limpeza de navegador, modo privado e expiração de sessão são riscos).

**Não importar o módulo no `App.tsx` público antes de concluir a migração e o teste em staging**. A POC deve continuar com dados fictícios claramente identificados; caso a API falhe, não falsificar contagens reais.

Os testes `tests/client.test.mjs` verificam agrupamento 30+30+5, falha de rede e retry com o mesmo ID, troca A→B e fila restaurada.

## Migration: operação deliberadamente manual

O arquivo `infra/sql/0002-participation-core.sql` cria as quatro tabelas de produto; `0003-time-balances.sql` acrescenta expiração por par:

- `world_pulse.tags`
- `world_pulse.visitors`
- `world_pulse.visitor_tags`
- `world_pulse.tap_batches`

Requer `0001-runtime-access.sql` já executado e role `world_pulse_app`. **Executar com DATABASE_MIGRATION_URL e revisão explícita, nunca com DATABASE_URL do frontend/runtime.** Não rodar via CI de PR nem aplicar em produção antes de revisão. Exige grants DML, mas não permite ao runtime criar/apagar tabelas.

### Após aprovação da migração

1. Conferir grants e `sslmode=verify-full`, sem exibir URL ou credenciais.
2. Validar `POST /api/session` em HTTPS.
3. Em navegador A, criar e selecionar #gta6, enviar lote X com 3 clicks duas vezes: crédito total = 3, não 6.
4. Criar mesma hashtag no navegador B: ID e cor devem coincidir; duas sessões contam como dois participantes históricos.
5. No navegador A, selecionar #lofi, depois reenviar lote antigo de #gta6: crédito em #gta6, não em #lofi.
6. Enviar batchId usado com clicks diferentes: HTTP 409 e nenhum segundo adicional.
7. Verificar ausência de identificadores ou localizações individuais na rota pública de ranking.
8. Confirmar custos, retenção de sessões, consentimento/privacidade e limites antes de liberar ao público.

## Segurança e limitações

- Nenhuma variável sensível `VITE_*` ou segredo é enviado ao cliente. O serviço `pg` usa somente `DATABASE_URL` no ambiente Node da Vercel.
- A URL do banco **precisa** de `sslmode=verify-full`. Pool limitado a 3 conexões por instância de função (isso **não** garante 3 conexões no conjunto de instâncias).
- Cookie expira após 30 dias; visitantes já expirados ficam no banco até decidirmos política de retenção e limpeza. Não alegar anonimização completa.
- Proteção de taxa só por sessão é contornável criando várias sessões, motivo para testar WAF/limites globais antes de abertura ampla.
- Um backend público escrito sem proteção de limpeza/retention pode acumular registros; liberar apenas após etapa de abuso/privacidade.
- O transporte e congelamento de lotes estão implementados/testados; integração da interface, reconciliação do contador e política de retenção ainda precisam ser concluídas.
- O MVP atual estático e o seu aspecto noturno continuam funcionando caso API/banco fiquem indisponíveis, sem fallback que fabrique dados reais.

## CI com PostgreSQL descartável

A action [`Participation API CI`](../.github/workflows/participation-api-ci.yml) usa PostgreSQL 16 exclusivo do job para aplicar `0001`, `0002` e `0003` com conta de proprietário e conferir via role de runtime:

- Sessões independentes, somente hash do cookie salvo, sessão expirada recusada.
- Criação concorrente da mesma hashtag sem mudar ID/cor.
- Duas requisições simultâneas com **mesmo batchId** não duplicam segundos.
- Mesmo batchId de sessões diferentes não colide.
- Reuso do ID com conteúdo diferente recebe 409.
- A→B com lote atrasado de A credita/estende A sem trocar a seleção ativa.
- Saldo válido de oito horas recebe top-up exato; retry concorrente não estende novamente.
- Retorno à sessão, histórico preservado após expiração, múltiplos saldos e migração sem inventar saldo ativo.
- Rejeição de hashtag que nunca foi selecionada, limite de 120/min, ranking histórico e restrição de DDL.

O CI não usa Neon de produção, `DATABASE_URL` real nem segredos dos seus serviços.

## Testes sem banco

`tests/api.test.mjs` executa invariantes de normalização, sessão aleatória, hash, cor, UUID, limite de cliques, origem, cookie protegido e handler com dependências simuladas. Uma bateria adicional de integração com **PostgreSQL real descartável** deve ser executada depois de aprovação da migração. Teste de handler isolado não é prova de consistência de transações sob concorrência.

Relacionado a [#20](../issues/20), [#4](../issues/4), [#5](../issues/5), [#9](../issues/9), [#6](../issues/6).

## Evidência de CI desta branch — 24/10/2026

| Validação | Resultado |
|---|---|
| [Participation API CI — PostgreSQL 16 descartável](https://github.com/Faysk/world-pulse/actions/runs/40040828557) | **success** |
| [Visual POC CI — testes, build e Chromium desktop/mobile](https://github.com/Faysk/world-pulse/actions/runs/40040828538) | **success** |
| [Infrastructure CI](https://github.com/Faysk/world-pulse/actions/runs/40040828555) | **success** |
| Vercel preview `dpl_3Gn9dEtzQbfuNSSj45pNSocfYpKN` | **READY**, sem mudança em produção |

A validação comprova **código compilável e comportamento dos testes cobertos**, não implantação funcional no Neon de produção. A API real permanece bloqueada por `WP_API_ENABLED`, a migração não foi aplicada e não houve alteração da interface pública.
