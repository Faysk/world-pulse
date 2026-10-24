# 02 — Interação, hashtags, segundos e manchas

**Contrato atual, confirmado em 24/10/2026.** Implementação integrada na main;
ativação pública pausada. [Estado verificado e gates](36-prepublication-status.md).

## Participação e seleção

- Uma hashtag selecionada recebe os novos taps. Várias podem manter saldo positivo
  simultaneamente; trocar A→B não pausa nem remove o saldo de A.
- Cada tap elegível acrescenta +1 segundo. O saldo diminui pelo relógio do servidor,
  inclusive offline, até zerar. Retornar permite acrescentar ao saldo restante.
- A primeira criação normalizada define ID/cor aleatória persistente global;
  criações posteriores reutilizam ambos. Não existe catálogo temático fechado.
- NFKC, caixa uniforme e validação Unicode de 2–32 caracteres são implementados
  no servidor. [Contrato temporal](14-time-credit-contract.md).

## Gestos na experiência integrada

Tap curto em terreno sem área de participação ou botão +1 credita na selecionada.
Arrastar, aproximar, wheel, pinch, long-press e cancelar só navegam. Sem seleção,
não há crédito. Tocar um país colorido inspeciona a origem e não soma segundos;
escolher uma hashtag na lista também não soma. O país é capturado no início do
gesto: desaparecer antes da soltura não o transforma em contribuição.

A demonstração antiga usa hotspots sintéticos com comportamento próprio; ela não
é a experiência integrada. [Segurança de gestos](17-gesture-safety.md) e
[experiência real gated](29-live-experience.md) registram essa diferença.

## Contagens distintas

- Atual: pares sessão/hashtag com saldo positivo. Uma sessão conta uma vez por
  hashtag, tenha 1 segundo ou 8h. Ao expirar, sai do atual e do mapa.
- Histórico: par registrado desde criar/selecionar, mesmo antes de taps. Repetir
  a seleção não duplica o par. Não equivale à máxima simultânea histórica.
- Segundos creditados: soma histórica dos lotes confirmados e deduplicados.
- Saldo: `max(0, expires_at - server_now)`, separado do histórico.

Top 10 ordena participações atuais desc, nome normalizado asc e ID asc. Segundos
não pesam nem desempatam. Todas as hashtags podem disputar, sem mínimo de cinco
no ranking. O limiar geográfico é outro controle. [Ranking](24-ranking-contract.md).
Uma sessão pseudônima não comprova pessoa física única; várias sessões podem
pertencer à mesma pessoa e uma sessão pode participar em várias hashtags.

## Persistência e privacidade

Cookie HttpOnly/Secure, hash no banco, fila persistente coordenada entre abas,
binding de sessão e lotes idempotentes impedem retries de duplicar crédito.
Taps offline recebem crédito quando o servidor aceita o lote, na hashtag original;
o browser não determina timestamps retroativos. Após mais de 30 dias sem retorno
e todos os saldos zerados, o histórico é consolidado por hashtag e os vínculos
individuais removidos. [Retenção](27-retention-policy.md).

País é opcional, estimado pela conexão e só aceito de fonte de borda verificada.
Não se coleta cidade ou coordenada individual. Grupos conhecidos menores que cinco
são reunidos em OTHER; desconhecidos usam ZZ. Nenhum ganha posição inventada.
O limiar não garante anonimato. [Geografia](31-country-geography.md).

## Mapa atual e pesquisa

A experiência integrada oferece países multicolor, foco e busca/paginação de todas
as hashtags da leitura. Faixas aproximadas não são pontos pessoais, intensidade
por segundos ou medida da distribuição dentro do país. [Limites visuais](38-multicolor-countries.md).
Manchas orgânicas, agregação mais fina e FPS físico continuam na pesquisa #32.

## Aceite

Transações, sessões/abas, retorno, expiração, retry e gestos têm provas em
PostgreSQL descartável, Chromium emulado e HTTPS privado contra Neon staging real.
Borda/preview público, hardware físico e operação de produção ainda precisam dos
gates em docs/36. O site publicado continua sendo a demonstração anterior.
