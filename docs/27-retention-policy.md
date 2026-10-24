# 27 — Retenção e consolidação do histórico

Política confirmada pelo usuário em 24/10/2026, issue #64 / milestone v0.3.

## Regra e dados preservados

Uma sessão torna-se elegível após mais de 30 dias sem retorno autenticado e
somente quando TODOS os seus saldos estiverem zerados. Ter seleção ativa sem
saldo não prolonga presença. Um saldo positivo, mesmo em outra hashtag, impede
a consolidação de toda a sessão.

Para cada hashtag preservam-se a quantidade histórica de pares sessão/hashtag e
os segundos creditados. Seleções sem taps também contam no histórico. Isso não
é máxima de participantes simultâneos, nem contagem de pessoas físicas únicas.
Novos cookies/dispositivos podem representar novamente a mesma pessoa.

Depois da consolidação não existe associação entre esses totais e a sessão
original. Seu histórico individual não pode ser restaurado pelo navegador.
O ranking atual continua baseado SOMENTE nos pares com saldo positivo; os
totais consolidados não fabricam presença ou posição no mapa.

## Implementação

- `visitors.last_seen_at` registra somente o retorno mais recente, sem trajetória.
  Cada autenticação válida renova esse campo; leituras públicas não o alteram.
- A validade da sessão é renovada no retorno e considera saldos longos. A mesma
  credencial HttpOnly é renovada em `/api/session` e após taps, sem trocar o binding.
  O prazo nominal do cookie é limitado a 400 dias; o navegador pode apagar ou
  limitar cookies antes. Limpeza de cookies/dispositivo diferente impede recuperar
  uma identidade sem login; saldo e contagens continuam sendo do servidor.
- Migração `0005-retention-rollups.sql`: registros existentes recebem uma nova
  carência de 30 dias. Não inferimos inatividade antiga a partir de dados incompletos.
- `tag_history_totals`: uma linha por hashtag com contagens/segundos numéricos
  exatos, sem IDs de visitante, localização ou timestamps individuais.
- Seleção de até 100 sessões por execução (máximo configurável 1000), `FOR UPDATE
  SKIP LOCKED`, com os mesmos locks de visitante usados por autenticação/taps.
- Soma no agregado e DELETE do visitante (CASCADE pares/lotes) na MESMA transação.
  Se qualquer passo falhar, ambos voltam atrás; retry não duplica os totais.
- Ranking/histórico somam pares ainda vinculados + rollups. Máximo de rollup no
  join evita multiplicar o agregado por quantidade de pares ainda existentes.

`server/retention.mjs` recebe um pool explícito, usa limites transacionais de SQL
e retorna somente a quantidade consolidada. Não existe endpoint público de limpeza.

## Operação

CI aplica 0005 no PostgreSQL descartável. O workflow `Staging database` permite
`migrate`, `check` e `maintain` apenas em branches autorizadas, com endpoint Neon
fixado e expiração verificada. `maintain` usa somente runtime, não o proprietário.

Não há limpeza de produção agendada/ativada neste trabalho. Agendar e monitorar
execuções faz parte da ativação operacional, após revisar/aplicar migrações e
informação ao usuário; a política não deve ser descrita como prazo garantido
sem esse acompanhamento. O staging temporário expira em 31/10/2026.

Isso implementa uma regra técnica de minimização; não é certificação de
anonimização ou declaração de conformidade legal. Backups e logs do provedor
têm ciclos próprios que precisam entrar na revisão operacional de privacidade.

## Verificação

PostgreSQL testa histórico antes/depois, seleção sem taps, saldo positivo e
retorno recente protegidos, limite por execução, dedupe removido junto da
sessão, rollback injetado entre soma/delete, retry sem dupla contagem e sessão
bloqueada sendo pulada por SKIP LOCKED. Testes HTTP verificam renovação da mesma
credencial, flags protegidas e prazo de recuperação de saldo longo.
