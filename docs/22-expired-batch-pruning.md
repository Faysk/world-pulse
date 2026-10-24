# 22 — Retenção limitada de lotes de idempotência (issue #5)

**Status:** função manual, testada apenas em PostgreSQL descartável. Não há cron, chamada HTTP, migração nem limpeza ativa no Neon.

## Problema

A tabela `world_pulse.tap_batches` garante que um batchId repetido não credite o mesmo segundo duas vezes. Excluir lotes durante uma sessão válida quebra essa garantia, permitindo créditos repetidos após retries de rede. Por outro lado, mantê-los eternamente cria crescimento desnecessário de armazenamento.

## Corte de manutenção implementado

`pruneExpiredSessionBatches({limit:500})` elimina **somente** linhas de `tap_batches` cujo visitante está com `visitors.expires_at` há **mais de 24 horas no passado**:

- Sessão expirada não consegue autenticar-se novamente usando o cookie antigo; portanto, seu identificador de lote não pode ser apresentado pela API autorizada.
- Sessões atuais, recém-expiradas ou com tempo de graça ainda preservam todos os batch IDs.
- Pagina no máximo 500 registros por invocação (configurável 1–5000); `FOR UPDATE SKIP LOCKED` e exclusão por chave composta.
- Não apaga `visitors`, `visitor_tags`, `seconds`, `expires_at` dos saldos nem contagens históricas.
- Não retorna tokens, IDs individuais nem registros removidos: resposta é somente número de batches apagados.
- Não altera quaisquer outras tabelas ou chama recursos fora do banco.

**NÃO** autorizar limpeza de `visitors` usando `DELETE CASCADE` antes de definir como preservar métricas históricas sem reter dados identificáveis. Isso alteraria históricos e ranking.

## Teste em banco descartável

`tests/integration.test.mjs` cria um visitante válido e outro expirado há 26 horas, gera lotes, testa `limit=1` repetido e confirma:

- os dois batches antigos são eliminados em duas chamadas;
- o lote do visitante ativo permanece;
- os saldos históricos `5` e `1` ficam intactos;
- a sessão antiga não autentica; a válida continua válida;
- limites inválidos são recusados.

## Bloqueios de produto

1. A função **não é invocada em deploy nem em cron**. A política de execução e auditoria aguarda staging remoto #53.
2. Confirmar efeitos em sessões anonimizadas, expiração dos cookies, cenário de múltiplas abas e timeouts transacionais.
3. Política RGPD: prazos de retenção dos dados de `visitors` e de `visitor_tags` ainda precisam de decisão. O tratamento de exclusão do titular não está pronto.
4. Definir gatilhos de custo, limites de requests e prevenção de cadastro automatizado antes de publicar escrita.
5. Não existe SQL aplicado em produção e `WP_API_ENABLED` permanece desligado.

Este slice resolve **somente a retenção segura de IDs de batches de sessões antigas**, não toda a issue #5.
