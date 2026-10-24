# 29 — Experiência integrada de participação

Issue #68, milestone v0.4. A experiência usa o mesmo cliente/API validados,
com criação/seleção de hashtags livres, cor persistida, taps no planeta ou botão,
fila pendente, confirmação, múltiplos saldos e ranking atual. O ranking atualiza
após confirmação e a cada 5s com aba visível; falha é indicada sem inventar zero.

## Dados e mapa

Nenhuma população sintética é passada ao globo nesta experiência. A geografia
pública ainda não existe; o mapa usa coleção vazia e luzes urbanas decorativas
desligadas. A ausência é explicada. Ranking pode ter participações enquanto o
mapa aguarda uma fonte segura; não converter país/IP em posição individual.
O protótipo visual continua disponível separadamente na página padrão.

O hook mantém um cliente por montagem, sincronização limitada em background
visível, seleção entre abas, fila persistente e quarentena. Falha permite retry;
taps só saem da fila após confirmação. Rotação não transfere taps antigos. O
intervalo de envio não reinicia a cada tap: interação contínua não impede flush.

Gestos usam o reconhecedor existente: tap curto elegível adiciona +1; drag,
wheel, pinch e cancelamento navegam. Seleção pelo ranking não soma tempo.
O contador confirmado usa snapshots/relógio monotônico, sem inventar saldo local.

## Acesso

- Local: `npm run dev` e `/?experiencePreview=1`. API real requer o harness
  PostgreSQL descartável ou ambiente deliberadamente configurado; Vite sozinho
  não fornece os handlers de participação.
- Build preview: exige `VERCEL_ENV=preview` e `WP_PREVIEW_UI=true` no build,
  além da URL opt-in. O bundler recebe apenas um boolean, não as variáveis privadas.
- Production: o mesmo flag com `VERCEL_ENV=production` não habilita a tela.
  Query string não altera esse resultado nem ativa `WP_API_ENABLED`.
- Backend permanece independente: uma UI autorizada não desbloqueia a API.

## Verificação

- Testes de browser desktop/mobile com falha, retry, seleção, retorno e captura.
- Teste HTTP/PostgreSQL descartável com tap real no canvas, drag sem crédito,
  saldo/histórico após reload e verificação direta dos registros.
- Duas builds estáticas testadas no browser: production recusa opt-in mesmo com
  flag true, preview explicitamente autorizado monta a UI. Diretórios e
  artefatos separados impedem colisão entre execuções.
- A captura de testes usa cartografia mínima, não comprova tiles/QA físico.

Ainda pendentes: conectar fonte geográfica confiável, globo de agregados reais,
preview HTTPS com secrets de staging e validação física antes da alpha pública.
