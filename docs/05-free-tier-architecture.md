# 05 — Arquitetura real e orçamento gratuito

**Atualizado em 25/10/2026.** Fonte operacional: [runbook](11-infrastructure-operations.md). Rastreio: #7, #20 e #37.

## Implantado

| Componente | Responsabilidade | Limite de escopo atual |
| --- | --- | --- |
| React + TypeScript + Vite | Interface estática compilada | Alpha pública com saldos e ranking reais |
| MapLibre GL + OpenFreeMap | Globo vetorial e cartografia | Sem posições pessoais; fonte de país desativada |
| Vercel Hobby | Entrega do app e HTTPS | API real integrada e ativa |
| Cloudflare DNS | Resolver `map.faysk.dev` para a Vercel | DNS only; Cloudflare não hospeda o frontend |
| Neon Free / PostgreSQL | Banco relacional com TLS e role runtime restrita | Schema 0001–0006 e runtime restrito ativos em produção |
| Cloudflare R2 Standard | Armazenamento S3 privado | Apenas provisionamento/probes; não participa dos taps nem fornece os tiles |
| GitHub Actions | Validar, sincronizar configuração e publicar | Environment `production`, branch `main`; sem secrets em PRs |
| Feed Steam | Endpoint Vercel para dados externos de jogos | Publicado pelo PR #41; amostra externa independente do banco e das manchas |

O navegador recebe HTML/JS/CSS da Vercel e tiles do OpenFreeMap. Não recebe credenciais PostgreSQL ou R2. O GitHub é a origem da configuração de produção; o workflow sincroniza somente a lista autorizada de variáveis server-side para a Vercel.

## Participação real e gates separados

O PR #31 integra sessões, hashtags, lotes idempotentes, múltiplos saldos e ranking.
A alpha/API foram ativadas em 25/10 pelo Actions, com migrações verificadas e
retenção monitorada habilitada. Ranking atual conta pares sessão/hashtag com saldo
positivo, independentemente de segundos; histórico fica separado. A fonte de país
permanece fechada até validar a borda. [Recibo e limites](39-production-alpha-release.md).

Não foi adotado serviço externo de Auth/Realtime nem WebSocket por visitante. Agregados por viewport/zoom e mecanismo de atualização permanecem em projeto; H3 é alternativa de implementação, não dependência instalada.

## Custos e limites

Provisionamento em plano gratuito não garante operação gratuita com qualquer volume. Conferir quotas e uso nos painéis antes de ampliar o público:

- [Vercel Hobby](https://vercel.com/docs/plans/hobby): requests, Functions, transferência e restrições do plano.
- [Neon](https://neon.com/pricing): armazenamento, compute, conexões e latência ao acordar.
- [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/): armazenamento e operações; excedentes podem ser cobrados.
- [OpenFreeMap](https://openfreemap.org/): disponibilidade, atribuição e condições da cartografia.

Enviar taps em lotes idempotentes, não escrever no banco a cada segundo do saldo. Calcular saldo por expiração, sem heartbeat obrigatório. Medir payload, consultas e frequência de atualização antes de escolher cache, Redis ou infraestrutura adicional. R2 só recebe novas funções quando houver benefício concreto de produto.

## Evidência e limites

[Publicação pelo Actions](https://github.com/Faysk/world-pulse/actions/runs/40041911767): conexão Neon/R2, sincronização server-side, candidata, smoke HTML/JS/CSS, revogação temporária, promoção e smoke público concluídos. Isso não prova persistência de participação real.

[Cenários visuais](15-population-scenarios.md): até 1 trilhão representado por no máximo 756 células sintéticas. Não é teste de bilhões de conexões nem benchmark do banco nessa escala.
