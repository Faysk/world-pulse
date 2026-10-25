# 25 — Orçamento de operações da API

Issue #60, milestone v0.3. Controles de aplicação para a alpha, sem dependência
de API da Vercel. Não são cotas comerciais do provedor nem promessa de custo zero.

## Limites iniciais compartilhados

| Categoria | Limite | Janela fixa UTC |
|---|---:|---|
| Pedidos válidos da API | 3.000 | minuto |
| Pedidos válidos da API | 50.000 | dia |
| Leituras de ranking/atividade/histórico | 600 | minuto |
| Criação de sessões | 2.000 | hora |
| Tentativas de criação de hashtags ainda inexistentes | 500 | hora |

São limites globais do banco, não por instância, IP ou pessoa. Cada pedido
válido consome a quota geral mesmo se a operação posterior falhar. Uma tentativa
com quota de minuto esgotada ainda pode consumir a quota diária: esse contador
representa pedidos que chegaram ao controle, não só operações bem sucedidas.

Os valores ficam versionados em `server/costPolicy.mjs`; exigem calibração com
tráfego e recursos reais antes da alpha. Não escalam o plano gratuito para
milhões/bilhões de pessoas. A quota de 1.200 taps/minuto/sessão continua separada.

## Atomicidade e dados mínimos

Migração manual `0004-operation-budgets.sql` cria no máximo cinco linhas, com
nomes permitidos por CHECK, janela e uso. Não grava IP, fingerprint, coordenada,
identificador de sessão nem uma linha por pedido. A atualização condicional
atômica só admite consumo até o limite e renova a linha na próxima janela.
Não há cron nem acumulação ilimitada de linhas. Instâncias/pools compartilham os
mesmos contadores. Ordem fixa dos locks reduz risco de deadlock.

HTTP 429 `operation_budget_exhausted` impede a operação de domínio seguinte;
503 `operation_budget_unavailable` bloqueia o fluxo se o controle não funcionar
ou a migração estiver ausente. `Retry-After: 60` orienta espera mínima; não
significa que quotas diárias/horárias já terão sido renovadas após esse minuto.
O laboratório mantém lotes e exige retry deliberado após erro.

Pool da API: até 3 conexões por instância, connect 5s e timeout do driver em
6s. Statement 5s, lock 1s e idle-in-transaction 10s são configurados com `SET LOCAL`
dentro da mesma transação de cada operação SQL, incluindo leituras e orçamento.
O pooler Neon não preservou parâmetros de startup: a verificação detectou isso
e a correção transacional passou no pooler real de staging (run 40052178137).
Não confundir timeout no driver com cancelamento do trabalho no servidor.
[node-postgres](https://node-postgres.com/apis/client) documenta os parâmetros do driver.

## Limites que permanecem

- Rejeitar ainda executa função e consulta o contador: isto NÃO é proteção
  DDoS, teto financeiro garantido ou substituto de firewall/limites do provedor.
- Um atacante pode esgotar quotas e causar indisponibilidade; falhar fechado
  é uma escolha conservadora para a homologação, não uma defesa antifraude completa.
- Contadores compartilhados são pontos de contenção e precisam de medição.
- Histórico e sessões ainda precisam de retenção/privacidade e monitoramento
  de armazenamento; limite de criação não é limpeza de dados antigos.
- Consultas de ranking ainda agregam tabelas de produto. A quota limita frequência,
  mas cache/agregados materializados precisam ser medidos antes de crescer.
- Alterar o banco diretamente não é uma interface pública; o controle não protege
  contra credencial de banco comprometida. Runtime segue restrito e server-only.

## Operação e verificação

Produção permanece `WP_API_ENABLED` desligado. A migração 0004 foi aplicada no
PostgreSQL descartável e no staging pelo Actions (run 40051933404). Esse primeiro
run aplicou SQL mas falhou na checagem de timeouts; a checagem corrigida foi
aprovada em 40052178137. Nenhuma dessas migrações foi aplicada na produção.
`infra-staging.yml` ganha escolha `check`/`migrate`: o proprietário só é fornecido
no passo manual migrate; o script recusa endpoint/banco/role/TLS/expiração errados.
Nenhum deploy aplica SQL, e nenhum runtime recebe a conexão de proprietário.

Testes PostgreSQL: pools independentes disputam as três últimas vagas da quota,
somente três recebem autorização; contador não ultrapassa o teto; janela vencida
renova; número de linhas é limitado. Teste HTTP confirma que a negação não chama
as operações de domínio. Testes de fila/retry e sessão continuam obrigatórios.
