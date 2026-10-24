# 07 — Roadmap atual e aceites

**Atualizado em 24/10/2026.** O [painel de milestones](https://github.com/Faysk/world-pulse/milestones) é a fonte do progresso vivo. Sem estimativas ou deadlines inventados.

## Entregue

- POC React/TypeScript/Vite + MapLibre publicada em `map.faysk.dev`, com dados simulados explícitos.
- Neon PostgreSQL, DNS Cloudflare e R2 privado provisionados; secrets centralizadas no GitHub.
- Actions valida app sem production secrets; candidata é testada e acesso temporário revogado antes da promoção.
- Testes de taps/navegação, saldo cronológico puro e cenários exatos de zero a 8 bilhões e 1 trilhão agregado.
- Regra de participação confirmada: saldo positivo por hashtag, diminuindo offline; múltiplas manchas simultâneas, uma seleção para novos taps.

## Próximo corte: participação real pequena

1. Revisar API em draft (#31/#20), sem confundir créditos históricos com saldo ativo.
2. Persistir expiração e histórico por navegador/hashtag; lote repetido não pode estender a expiração novamente (#5).
3. Validar migração, grants e concorrência no PostgreSQL descartável, depois ambiente isolado.
4. Integrar cliente ao backend: hashtag/cor persistentes, seleção, lotes, confirmação e retorno à sessão (#3/#4).
5. Definir retenção, tratamento de lotes atrasados e limites de escrita/custo antes de ativar a API publicamente.
6. Validar dois navegadores e interrupções de rede; só depois planejar ativação controlada (#13).

O globo público permanece identificado como simulação enquanto não houver agregados reais aprovados. A migração de domínio não roda automaticamente no deploy.

## Geografia e ranking

- Região aproximada de fonte confiável; sem sinal válido, usar desconhecido (#6).
- Definir proteção de regiões com poucos participantes antes de publicar manchas reais.
- Definir ordenação e desempates do Top 10 (#8); manter saldo, histórico e pessoas distintos.
- Agregar no servidor e retornar payload limitado; não expor participantes individuais.

## Visual e qualidade

- Agregação por zoom e composição de hashtags coincidentes (#32).
- PC e celular físico: mapa real, zoom mundo/país/cidade, gestures e rede lenta (#12).
- Medir frame times, memória, payload, camadas e frequência de atualizações. CI emulado não substitui GPU/dispositivo real.
- Cenários agregados não comprovam capacidade para bilhões de usuários reais.

## Aceites do primeiro fluxo real

- Dois navegadores criam o mesmo # e recebem uma cor persistente única.
- Muitos taps de um navegador continuam sendo um participante por hashtag com saldo positivo.
- Trocar A → B preserva saldo/histórico de A; A continua diminuindo enquanto novos taps vão para B.
- Fechar e retornar conserva apenas o saldo ainda não expirado, além do histórico.
- Retry do mesmo lote não duplica histórico nem expiração; concorrência não perde crédito.
- Drag/pinch não credita; seleção sozinha não cria saldo.
- Expiração, sessão, limites e erros de rede têm estados claros na interface.
- Nenhum dado individual ou segredo é enviado em agregados públicos.
