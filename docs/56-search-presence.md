# 56 — Ícones, metadados e descoberta pública

26/10/2026 · #160 · milestone v0.4.

## Identidade e compartilhamento

Símbolo próprio: globo com pulso, branco/cinza sobre #101112. Fonte editável em
`public/favicon.svg`; social em `brand/social-card.svg`. PNGs e ICO são renderizados
localmente por `node scripts/generate-brand-assets.mjs` com o Playwright já fixado
no lockfile. Não baixa imagens nem usa dados de visitantes. Binários ficam no Git.

- favicon.svg e favicon.ico com 16/32/48 px; PNG de 48 px para buscadores;
- apple-touch-icon de 180 px; ícones de app 192/512 px e maskable 512 px com margem;
- social-card.png 1200×630 e texto alternativo em Open Graph/Twitter;
- site.webmanifest com id/start_url/scope `/`, cores e ícones locais.

Manifesto não implementa service worker, modo offline nem cache de localização.
O globo continua sendo a tela inicial. A marca visível recebe semântica h1,
e a ajuda inclui link à apresentação no idioma atual.

## Conteúdo que pode ser encontrado

O HTML inicial de `/` contém marca, explicação curta e links, mesmo sem executar
JavaScript. React substitui esse estado inicial pelo app; não há conteúdo diferente
para robôs ou navegador. O globo precisa de JavaScript/WebGL. As páginas estáticas
de apresentação são legíveis sem JavaScript:

- `/about/` — English;
- `/pt/sobre/` — Português;
- `/es/acerca/` — Español.

Cada apresentação tem título/descrição próprios, idioma HTML, canonical absoluto
e alternates hreflang recíprocos, com x-default em inglês. Não inventamos URLs
traduzidas para o mapa: ele mantém canonical único em https://map.faysk.dev/ e
o idioma segue a escolha/região do usuário no app.

Os textos explicam sessões ativas, tempo, localização aproximada de 1 km,
retirada e limites de privacidade/retenção. Não prometem anonimato, GPS exato
ou pessoas únicas. Links de fonte levam ao repositório público existente.

O head está no HTML gerado, não depende de chamada à API: título, descrição,
canonical, Open Graph, Twitter e JSON-LD WebSite/WebApplication. Sem avaliações,
preços, pessoas, SearchAction ou URLs de hashtags inventados.

## Regras de indexação

O plugin `build/search-presence.mjs` usa o mesmo gate da alpha pública:
somente `VERCEL_ENV=production` com `WP_ALPHA_RELEASE=true` gera `index, follow`,
robots permitindo páginas públicas e sitemap com quatro URLs reais. Dev, preview
e builds de demo ficam noindex/nofollow, robots Disallow / e sitemap vazio.
Um build local comum não comprova que a produção está indexável; conferir o
build público e a resposta HTTPS final.

Robots público restringe `/api/` para evitar crawling de snapshots/rotas de sessão.
Vercel adiciona X-Robots-Tag noindex/nofollow a `/api/:path*`. Robots não é controle
de acesso nem proteção de dados; limites de API permanecem. Assets/JS/CSS e favicon
podem ser rastreados. Canonical aponta ao domínio oficial também nos deployments.

Sitemap não inclui sessões, coordenadas, buscas de hashtags ou query strings.
Não há lastmod artificial atualizado em cada build nem URLs inexistentes.
O host já devolve 404 real em caminhos desconhecidos; essa topologia foi preservada.

## Validação e acompanhamento

Testes verificam gate de produção/preview, canonical único, JSON-LD, links de idioma,
sitemap, tamanho real dos PNGs e entradas ICO. Navegadores desktop/mobile com JS
desligado percorrem as três apresentações e verificam ausência de overflow.
Arte e página mobile foram inspecionadas visualmente. CI e recibo de publicação
serão registrados ao concluir a entrega.

Indexável não significa indexado ou bem posicionado: a decisão e o prazo são dos
buscadores. Search Console/sitemap e inspeção de URL ajudam a acompanhar quando
há propriedade verificada. Não adicionar token de verificação fictício nem afirmar
envio/indexação sem recibo. Nenhuma credencial de buscador entra no código.

Fontes oficiais consultadas em 26/10/2026:
[JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)
e [robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
