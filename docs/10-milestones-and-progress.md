# World Pulse — Releases, Milestones e progresso

**Atualizado em:** 23/10/2026  
**Status:** planejamento organizado nas Issues. **Milestones nativos ainda precisam ser criados no GitHub e vinculados** — o conector atual não disponibiliza criação de milestones. Não considerar a simples classificação de issues como milestone nativo já concluído.

## Visão geral — ordem das entregas

| Milestone nativo a criar (título exato) | Propósito | Issues | Estado inicial |
|---|---|---|---|
| `v0.1 — Living Earth (Visual POC)` | Globo cinza, zoom de alta qualidade, Night Lights e demo Vercel | [#1](../../issues/1), [#2](../../issues/2), [#10](../../issues/10), [#11](../../issues/11), [#12](../../issues/12) | 0/5 concluídas |
| `v0.2 — Hashtags & Taps` | Seleção de hashtags, cor aleatória persistente e +1 segundo por tap | [#3](../../issues/3), [#4](../../issues/4) | 0/2 concluídas |
| `v0.3 — Data & Presence` | Contribuições persistentes, presença, geografia aproximada e infra gratuita | [#5](../../issues/5), [#6](../../issues/6), [#7](../../issues/7), [#9](../../issues/9) | 0/4 concluídas |
| `v0.4 — World Pulse Alpha` | Top 10, origem por país, integração e validação de público | [#8](../../issues/8), [#13](../../issues/13) | 0/2 concluídas |

**Total:** 13 issues abertas, nenhuma concluída no momento da criação deste documento. Essa contagem é um **snapshot**, não um widget ao vivo. Após associar as issues a milestones nativos, a página [GitHub Milestones](https://github.com/Faysk/world-pulse/milestones) mostrará o percentual **automaticamente a partir das issues fechadas**.

Não inventar deadlines; escolher `No due date` por enquanto.

## v0.1 — Living Earth (Visual POC)

**Objetivo:** uma preview navegável do globo cinza, nítida no zoom e com manchas de luz dinâmicas baseadas em participantes **simulados**.

**Ordem de trabalho sugerida:**
1. [#1 — Benchmark de motores e nitidez](../../issues/1) — provar base gráfica, tiles vetoriais, zoom.
2. [#11 — Base React/TS + MapLibre](../../issues/11) — preparar projeto executável.
3. [#2 — Manchas orgânicas](../../issues/2) — densidade por pessoa (nunca taps).
4. [#10 — Living Lights / Night Lights](../../issues/10) — estética cinza com expansão de luzes.
5. [#12 — Benchmark e preview Vercel](../../issues/12) — testar qualidade e publicar demonstração gratuita.

**Critérios de conclusão do milestone:**
- Zoom continente→país→cidade com novos detalhes e **sem pixelização grosseira**.
- Drag/zoom/pinch fluidos no desktop e celular.
- Manchas multicoloridas simuladas apresentam intensidade por **pessoas distintas**.
- Preview visual na Vercel, com métricas de desempenho documentadas.
- Nenhum dado fictício se apresenta como participação real.

## v0.2 — Hashtags & Taps

[#3 — UX do tap +1](../../issues/3) · [#4 — Hashtags e cores](../../issues/4)

- Criar/selecionar #, inclusive escolher uma cor/hashtag existente.
- Primeira criação sorteia cor e a reutiliza.
- Cada tap/click elegível = **+1 segundo**; zoom e drag não pontuam.
- Uma seleção ativa por vez; trocar # preserva acumulados das outras.
- Interface minimalista, sem filtros.

**Aceite:** 1 participante com muitos taps continua gerando **só uma pessoa** na mancha.

## v0.3 — Data & Presence

[#5 — Segundos persistentes e idempotência](../../issues/5) · [#6 — Geo aproximada](../../issues/6) · [#7 — Infra Free](../../issues/7) · [#9 — Regra de presença](../../issues/9)

- Fechar sem ambiguidades o que é presença geográfica e sua expiração, **sem expirar os segundos históricos por engano**.
- Gravar contadores duráveis por participante+hashtag.
- Sincronizar taps em lotes com idempotência, não request por click.
- Geolocalização aproximada IP→célula; sem coordenadas residenciais.
- Vercel + Cloudflare DNS/R2 + Supabase sem cobrança obrigatória.
- Publicar ao cliente apenas agregados geográficos, nunca posições individuais.

## v0.4 — World Pulse Alpha

[#8 — Ranking Top 10 e origem](../../issues/8) · [#13 — Integração e qualidade Alpha](../../issues/13)

- Mostrar Top 10 global de todas hashtags válidas; sem número mínimo nem filtros.
- Exibir origem por país/região agregada, com métricas claramente nomeadas.
- Integrar dados reais ao globo e validar ponta a ponta.
- Testar PC/celular, limites do Free, status de privacidade antes da estreia.
- Não inventar usuários; zero pessoas = zero atividade.

## Como criar os quatro milestones nativos no GitHub

A conexão GitHub usada nesta etapa consegue **editar issues e definir um milestone numérico existente**, mas **não criar milestones** nem consultar a coleção diretamente. Por isso, as 13 issues já receberam o prefixo `[v0.x]` e referência a este documento, **mas o campo GitHub Milestone ainda não foi preenchido**.

**Um único passo manual preparatório no site:**
1. Acesse [New milestone](https://github.com/Faysk/world-pulse/milestones/new) e crie os **quatro títulos exatamente como na tabela**, usando `No due date`.
2. Depois, a conexão pode recuperar o número dos milestones pela informação presente nas issues e associar os itens com `update_issue(milestone=...)`, verificando o resultado, ou você pode vincular os itens em lote pelo GitHub Issues.
3. [Confira a porcentagem real em Milestones](https://github.com/Faysk/world-pulse/milestones). GitHub faz o cálculo por **issues fechadas**, não por checkboxes internos.

**Não fechar issues antes do aceite real:** documento de planejamento publicado não significa feature implementada.

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
