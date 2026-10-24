# World Pulse — Releases, Milestones e progresso

**Atualizado em:** 24/10/2026
**Status:** ✅ **Quatro milestones nativos criados no GitHub, com as 13 issues vinculadas e verificadas individualmente.** O workflow `.github/workflows/setup-milestones.yml` realiza a criação/vinculação de modo idempotente.

## Estado atual

Base React (#11) concluída; comparação de três motores (#1) encerrada como não planejada. Ranking atual confirmado por saldo positivo, histórico desde seleção e máxima histórica separada. Fila coordenada entre abas e orçamentos compartilhados na cadeia da API experimental. [Inventário operacional atual](26-readiness.md). As tabelas de contagem inicial abaixo são históricas, não o progresso atual.


POC publicada, infraestrutura provisionada, contrato de saldo confirmado (#9), cenários entregues (#30) e pipeline staged validado. API real permanece em draft (#31), sem migração/ativação pública. #32 trata os limites visuais encontrados. Os números abaixo descrevem o planejamento inicial; o painel GitHub é a fonte do progresso atual.

## Visão geral — ordem das entregas

| Milestone GitHub | Propósito | Issues | Estado inicial |
|---|---|---|---|
| [v0.1 — Living Earth (Visual POC)](https://github.com/Faysk/world-pulse/milestone/1) | Globo cinza, zoom de alta qualidade, Night Lights e demo Vercel | [#1](https://github.com/Faysk/world-pulse/issues/1), [#2](https://github.com/Faysk/world-pulse/issues/2), [#10](https://github.com/Faysk/world-pulse/issues/10), [#11](https://github.com/Faysk/world-pulse/issues/11), [#12](https://github.com/Faysk/world-pulse/issues/12) | 0/5 concluídas |
| [v0.2 — Hashtags & Taps](https://github.com/Faysk/world-pulse/milestone/2) | Seleção de hashtags, cor aleatória persistente e +1 segundo por tap | [#3](https://github.com/Faysk/world-pulse/issues/3), [#4](https://github.com/Faysk/world-pulse/issues/4) | 0/2 concluídas |
| [v0.3 — Data & Presence](https://github.com/Faysk/world-pulse/milestone/3) | Contribuições persistentes, presença, geografia aproximada e infra gratuita | [#5](https://github.com/Faysk/world-pulse/issues/5), [#6](https://github.com/Faysk/world-pulse/issues/6), [#7](https://github.com/Faysk/world-pulse/issues/7), [#9](https://github.com/Faysk/world-pulse/issues/9) | 0/4 concluídas |
| [v0.4 — World Pulse Alpha](https://github.com/Faysk/world-pulse/milestone/4) | Top 10, origem por país, integração e validação de público | [#8](https://github.com/Faysk/world-pulse/issues/8), [#13](https://github.com/Faysk/world-pulse/issues/13) | 0/2 concluídas |

**Total:** 13 issues abertas, nenhuma concluída na verificação inicial. Essa contagem é um **snapshot**, não um widget ao vivo. Os quatro milestones nativos estão ativos e [GitHub Milestones](https://github.com/Faysk/world-pulse/milestones) calcula o progresso **automaticamente a partir das issues fechadas**.

Não inventar deadlines; escolher `No due date` por enquanto.

## v0.1 — Living Earth (Visual POC)

**Objetivo:** uma preview navegável do globo cinza, nítida no zoom e com manchas de luz dinâmicas baseadas em participantes **simulados**.

**Ordem de trabalho sugerida:**
1. [#1 — Benchmark de motores e nitidez](https://github.com/Faysk/world-pulse/issues/1) — provar base gráfica, tiles vetoriais, zoom.
2. [#11 — Base React/TS + MapLibre](https://github.com/Faysk/world-pulse/issues/11) — preparar projeto executável.
3. [#2 — Manchas orgânicas](https://github.com/Faysk/world-pulse/issues/2) — densidade por pessoa (nunca taps).
4. [#10 — Living Lights / Night Lights](https://github.com/Faysk/world-pulse/issues/10) — estética cinza com expansão de luzes.
5. [#12 — Benchmark e preview Vercel](https://github.com/Faysk/world-pulse/issues/12) — testar qualidade e publicar demonstração gratuita.

**Critérios de conclusão do milestone:**
- Zoom continente→país→cidade com novos detalhes e **sem pixelização grosseira**.
- Drag/zoom/pinch fluidos no desktop e celular.
- Manchas multicoloridas simuladas apresentam intensidade por **pessoas distintas**.
- Preview visual na Vercel, com métricas de desempenho documentadas.
- Nenhum dado fictício se apresenta como participação real.

## v0.2 — Hashtags & Taps

[#3 — UX do tap +1](https://github.com/Faysk/world-pulse/issues/3) · [#4 — Hashtags e cores](https://github.com/Faysk/world-pulse/issues/4)

- Criar/selecionar #, inclusive escolher uma cor/hashtag existente.
- Primeira criação sorteia cor e a reutiliza.
- Cada tap/click elegível = **+1 segundo**; zoom e drag não pontuam.
- Uma seleção ativa por vez; trocar # preserva acumulados das outras.
- Interface minimalista, sem filtros.

**Aceite:** 1 participante com muitos taps continua gerando **só uma pessoa** na mancha.

## v0.3 — Data & Presence

[#5 — Segundos persistentes e idempotência](https://github.com/Faysk/world-pulse/issues/5) · [#6 — Geo aproximada](https://github.com/Faysk/world-pulse/issues/6) · [#7 — Infra Free](https://github.com/Faysk/world-pulse/issues/7) · [#9 — Regra de presença](https://github.com/Faysk/world-pulse/issues/9)

- Fechar sem ambiguidades o que é presença geográfica e sua expiração, **sem expirar os segundos históricos por engano**.
- Gravar contadores duráveis por participante+hashtag.
- Sincronizar taps em lotes com idempotência, não request por click.
- Geolocalização aproximada IP→célula; sem coordenadas residenciais.
- Vercel + Cloudflare DNS/R2 + Neon PostgreSQL sem cobrança obrigatória.
- Publicar ao cliente apenas agregados geográficos, nunca posições individuais.

## v0.4 — World Pulse Alpha

[#8 — Ranking Top 10 e origem](https://github.com/Faysk/world-pulse/issues/8) · [#13 — Integração e qualidade Alpha](https://github.com/Faysk/world-pulse/issues/13)

- Mostrar Top 10 global de todas hashtags válidas; sem número mínimo nem filtros.
- Exibir origem por país/região agregada, com métricas claramente nomeadas.
- Integrar dados reais ao globo e validar ponta a ponta.
- Testar PC/celular, limites do Free, status de privacidade antes da estreia.
- Não inventar usuários; zero pessoas = zero atividade.

## Milestones nativos — criados e verificados

O conector do GitHub não oferecia a operação para criar milestones diretamente. Resolvemos com o workflow [`setup-milestones.yml`](../.github/workflows/setup-milestones.yml), publicado em `main`, que usa o `GITHUB_TOKEN` temporário do próprio GitHub Actions com a permissão mínima `issues: write`.

**Verificação:** as issues #1–#13 foram consultadas individualmente e têm exatamente estes números de milestone:
- **Milestone #1:** issues #1, #2, #10, #11, #12.
- **Milestone #2:** issues #3, #4.
- **Milestone #3:** issues #5, #6, #7, #9.
- **Milestone #4:** issues #8, #13.

O workflow é idempotente (reutiliza milestone existente e reaplica vínculos) e pode ser executado manualmente na aba Actions. Não é necessário criar milestones ou vincular issues manualmente. **Não executar de novo para usos cotidianos**; o painel de GitHub já atualiza o progresso conforme a issue é fechada.

[Abra o painel real de milestones](https://github.com/Faysk/world-pulse/milestones).

## Gestão simples do trabalho

- **Open** = ainda pendente; **Closed** = aceito/concluído.
- Comentários de testes e decisões importantes ficam na issue correspondente.
- Atualizações de documentação e código devem referenciar a issue/PR.
- Se algo for descartado, fechar com motivo `not planned` e registrar decisão.
- Dependências são indicadas no texto, não assumir que GitHub Milestones as executa.
- Revisar backlog ao concluir cada versão; evitar adicionar funcionalidades novas antes do primeiro globo funcional.

## Atalhos úteis

- [Todas as issues](https://github.com/Faysk/world-pulse/issues)
- [Issues da v0.1](https://github.com/Faysk/world-pulse/issues?q=is%3Aissue+%22%5Bv0.1%5D%22)
- [Issues da v0.2](https://github.com/Faysk/world-pulse/issues?q=is%3Aissue+%22%5Bv0.2%5D%22)
- [Issues da v0.3](https://github.com/Faysk/world-pulse/issues?q=is%3Aissue+%22%5Bv0.3%5D%22)
- [Issues da v0.4](https://github.com/Faysk/world-pulse/issues?q=is%3Aissue+%22%5Bv0.4%5D%22)
- [Milestones](https://github.com/Faysk/world-pulse/milestones)

## Infraestrutura provisionada em 23/10/2026

A configuração operacional foi entregue; o frontend do PR #14 já está integrado e publicado:

| Issue | Entrega | Milestone |
|---|---|---|
| #15 | GitHub Actions, secrets e documentação operacional | v0.3 — Data & Presence |
| #16 | Cloudflare DNS e verificação de map.faysk.dev | v0.1 — Living Earth (Visual POC) |
| #17 | Neon Free e acesso SQL restrito | v0.3 — Data & Presence |
| #18 | R2 privado e teste de objetos | v0.3 — Data & Presence |

Consulte o [runbook de infraestrutura](11-infrastructure-operations.md) para evidências, limites e pendências. Provisionamento não fecha automaticamente as issues de presença, persistência ou aprovação visual.
