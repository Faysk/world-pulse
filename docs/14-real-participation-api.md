# 14 — API experimental de participação real (revisão técnica, NÃO lançada)

**Branch:** `feat/real-participation-api` · **Estado:** implementação isolada, sem migração executada, sem exposição no globo público.

## Objetivo

Validar duas sessões distintas num backend PostgreSQL existente (Neon) antes de integrar geografia, presença ou ranking de atividade em tempo real. A POC visual atual **não foi alterada**: seus pontos e contadores continuam simulados.

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
7. Um lote de A pode chegar **depois** da troca para B se A já foi selecionada. Créditos vão para A, **sem** reativar A nem alterar `active_tag_id`.
8. O total persistido conta toques; **não é tempo cronológico**. O número de participantes históricos é contagem de sessões distintas com algum toque.
9. `/api/ranking` usa **métrica histórica declarada**, não presença ativa, não densidade geográfica e não a contagem mundial de pessoas físicas. Valores de segundos são strings decimais para evitar overflow de bigint no JavaScript.
10. Nenhum dado de IP, localização GPS, user-agent ou coordenada vai para este modelo. A região aparece como `unknown` conceitualmente até a decisão de #6. **Não mostrar os agregados no globo ainda.**

## Migration: operação deliberadamente manual

O arquivo `infra/sql/0002-participation-core.sql` cria apenas as quatro tabelas de produto:

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
- A geração de lotes pelo navegador e política de retry são o próximo trabalho do frontend, não presumir isso implementado.
- O MVP atual estático e o seu aspecto noturno continuam funcionando caso API/banco fiquem indisponíveis, sem fallback que fabrique dados reais.

## Testes sem banco

`tests/api.test.mjs` executa invariantes de normalização, sessão aleatória, hash, cor, UUID, limite de cliques, origem, cookie protegido e handler com dependências simuladas. Uma bateria adicional de integração com **PostgreSQL real descartável** deve ser executada depois de aprovação da migração. Teste de handler isolado não é prova de consistência de transações sob concorrência.

Relacionado a [#20](../issues/20), [#4](../issues/4), [#5](../issues/5), [#9](../issues/9), [#6](../issues/6).
