# 07 — Roadmap, ordem de trabalho e aceites

**Status:** proposta inicial de execução, sem datas/estimativas fechadas.

## Fase 0 — Planejamento (em andamento)

- [x] Criar repositório e documentação do conceito.
- [x] Registrar invariantes: cliques = segundos, pessoas = densidade.
- [ ] Resolver decisões abertas críticas de toque/navegação, presença e Top 10.
- [ ] Coletar e comparar referências práticas de motores gráficos.

## Fase 1 — Prova de conceito visual (primeira implementação)

1. Página abre diretamente no globo **cinza**.
2. Giro, zoom, pan e inércia (desktop e mobile).
3. Simular datasets de 1, 10, 100, 10k, 100k e 1M pessoas equivalentes.
4. Sortear e persistir **localmente apenas no demo** cores por hashtag.
5. Desenhar densidade por #, com bordas suaves e mistura/competição visual legível.
6. Aproximação progressiva com diferentes resoluções.
7. Instrumentar FPS, memória, transferência e performance.
8. Estudar tap curto +1 vs gesto de zoom/rotação.

**Aceite:** a experiência visual é convincente e responsiva; nenhuma sessão de usuário nem Supabase necessária ainda.

## Fase 2 — Mecânica local dos segundos

1. Selecionar/criar #, inclusive através de uma hashtag existente.
2. Cada toque elegível credita exatamente +1 s.
3. Troca de hashtag preserva segundos anteriores.
4. Nenhuma ação de zoom/arrastar soma segundos acidentalmente.
5. UI mostra cor, hashtag selecionada e segundos acumulados.
6. Automatizar testes das regras de contagem.

**Aceite:** 1.000 taps para uma única pessoa aumentam segundos, mas não a densidade.

## Fase 3 — Backend gratuito e localização aproximada

1. Site Vercel, domínio Cloudflare DNS, banco Supabase.
2. Hashtags únicas e cores atribuídas com transação/constraint.
3. ID pseudônimo e contribuições duráveis.
4. Geolocalização por IP e agregados de região sem coordenadas precisas.
5. Sync em lote idempotente; não escrever em banco por tap.
6. Top 10 global e origem agregada por país, conforme métrica escolhida.
7. Sem filtros.
8. Validar orçamento gratuito (request count, DB, egress).

**Aceite:** dois navegadores em locais distintos usam o mesmo # e cor; ambos somam uma pessoa cada na densidade, independente do número de taps.

## Fase 4 — Dinamismo e qualidade

- Animações de criação de mancha, adição de gente, dissolução conforme regra de presença.
- Interpolação suave entre snapshots e desempenho mobile.
- Acessibilidade, contraste, navegação teclado.
- Privacy notice/RGPD, logs mínimos, monitoramento do uso de free tier.

## Casos de teste obrigatórios

- [ ] 1 participante, 100.000 taps → 1 pessoa e 100.000 s.
- [ ] 100 participantes, 1 tap cada → 100 pessoas e 100 s.
- [ ] A → B → A sem apagar tempos anteriores.
- [ ] Mesmo # criado simultaneamente mantém uma única cor.
- [ ] Gesto drag/pinch não credita +1.
- [ ] Falha de rede + retry não duplica segundos.
- [ ] Sem localização confiável não revela nem inventa bairro.
- [ ] Concentrações distintas se unem visualmente só quando geograficamente próximas.
- [ ] Mesmo banco suporta leitura de total independentemente de a hashtag ser popular.
