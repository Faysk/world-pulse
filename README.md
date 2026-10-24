# World Pulse 🌍

Um planeta cinza que ganha cores com a participação das pessoas.

**Estado em 24/10/2026:** [demonstração visual publicada](https://map.faysk.dev), com dados simulados. A infraestrutura está provisionada; a aplicação ainda não grava participação real no banco de produção.

## Estrutura real

| Parte | Tecnologia / serviço | Estado |
| --- | --- | --- |
| Interface | React 19 + TypeScript + Vite | Publicada na Vercel |
| Globo | MapLibre GL + cartografia OpenFreeMap | Publicado; participantes sintéticos |
| Hospedagem | Vercel Hobby, projeto `world-pulse` | HTTPS em `map.faysk.dev` |
| Banco | Neon Free / PostgreSQL, Londres | Conectividade TLS e acesso SQL restrito verificados |
| DNS | Cloudflare, zona `faysk.dev` | `map` aponta à Vercel, DNS only |
| Objetos | Cloudflare R2, bucket privado `world-pulse-production` | Provisionado; ainda sem função no fluxo de taps |
| Configuração e entrega | GitHub Actions + Environments `production` e `staging` | Origem das secrets/configurações e deploy manual de `main` |
| Steam LIVE | `GET /api/steam` · Steam Web API oficial | **Oculto na interface de produção**, código e endpoint preservados para desenvolvimento |
| API de participação | [PR #31](https://github.com/Faysk/world-pulse/pull/31) | Draft, gate desligado em produção; PostgreSQL descartável e branch Neon staging isolada |

Não há serviço de autenticação externo, conexão direta do browser ao banco ou bucket público. Nenhum outro banco de outro projeto foi removido ou alterado.

```mermaid
flowchart LR
  DNS[Cloudflare DNS: map.faysk.dev] --> WEB[Vercel: React / Vite / MapLibre]
  WEB --> TILES[OpenFreeMap: cartografia]
  GH[GitHub Actions + production secrets] --> WEB
  GH --> DB[(Neon PostgreSQL: conectividade)]
  GH --> R2[Cloudflare R2 privado: probes]
  API[API experimental no PR 31] -. futura integração .-> DB
  WEB -. futura integração .-> API
```

Linhas pontilhadas representam o fluxo público ainda não ativado; o laboratório experimental já usa banco descartável no CI. O Neon staging remoto é uma branch separada, temporária, com expiração em 31/10/2026. [Staging](docs/18-remote-staging.md). Veja [arquitetura](docs/05-free-tier-architecture.md) e [operações](docs/11-infrastructure-operations.md).

O feed da Steam foi mantido no código, mas o painel foi **ocultado da experiência pública** por não ser parte do conceito central do World Pulse. Não há consultas Steam feitas pela interface enquanto estiver oculto. [Decisão e documentação da integração](docs/16-steam-live-signals.md).

## Regras do produto

- Cada tap elegível adiciona **+1 segundo de saldo** à hashtag selecionada e ao histórico creditado.
- O saldo diminui com o relógio real, inclusive offline. Histórico e saldo restante são métricas diferentes.
- Várias hashtags podem manter saldo/manchas simultaneamente; novos taps vão para uma seleção de cada vez.
- A densidade conta participantes distintos por hashtag com saldo positivo, nunca soma de taps ou segundos.
- Cor aleatória é persistida na primeira criação da hashtag; criação real ainda depende da API.
- Localização será aproximada e agregada; não publicar posição individual.
- Top 10 atual conta participações com saldo positivo; ao zerar, sai do ranking e da mancha. Histórico começa na seleção e fica separado. [Contrato](docs/24-ranking-contract.md).

A POC publicada ainda possui contador local por sessão; não confundir esse teste com saldo persistido em produção. [Contrato confirmado](docs/14-time-credit-contract.md).

## Executar e verificar

Node compatível com `package.json` (CI visual usa Node 22; infraestrutura usa Node 24):

```sh
npm ci
npm run dev
npm run check
npx playwright install chromium
npm run test:browser
npm ci --prefix infra --ignore-scripts
npm test --prefix infra
```

O app visual não exige secrets. Nunca colocar credenciais em `VITE_*` nem versionar `.env.local`.

## Organização do repositório

```text
src/                         interface, globo, datasets sintéticos e contrato de saldo
tests/                      testes de domínio e navegador
infra/                       probes Neon/R2, sincronização e publicação staged
infra/sql/0001-runtime-access.sql  baseline de acesso SQL; não é schema da aplicação
scripts/                     benchmark dos cenários agregados
api/steam.mjs                endpoint do feed externo Steam
server/steam.mjs             consulta/validação do feed externo
server/geoPrivacy.mjs       protótipo isolado de país aproximado e supressão
.github/workflows/           validação, produção manual e organização de milestones
docs/                        arquitetura, regras, evidências e pendências
```

As pastas `api/` e `server/` contêm o backend Steam preservado, porém sem painel visível no site público. Os demais endpoints de participação, `server/store.mjs`, `server/handlers.mjs`, o cliente `participationClient.ts` e as migrações `0002`–`0004` estão **somente no PR #31** enquanto ele permanecer em draft. A correção de saldo e retries foi integrada nesse draft pelo [PR #43](https://github.com/Faysk/world-pulse/pull/43), com testes em PostgreSQL descartável; isso ainda não ativa participação em produção.

## Documentação e próximos passos

- [Prontidão e estrutura real da API](docs/26-readiness.md)
- [Fila entre abas](docs/23-cross-tab-queue.md) · [Ranking atual/histórico](docs/24-ranking-contract.md) · [Orçamento de operações](docs/25-api-operation-budgets.md)

- [Visão e escopo](docs/01-vision-and-scope.md) · [Interação](docs/02-interaction-rules.md)
- [Arquitetura implantada](docs/05-free-tier-architecture.md) · [Modelo de domínio](docs/06-data-model.md)
- [Roadmap atual](docs/07-roadmap.md) · [Decisões abertas](docs/08-open-questions.md)
- [Milestones e entregas](docs/10-milestones-and-progress.md) · [Runbook de produção](docs/11-infrastructure-operations.md)
- [Revisão crítica atual](docs/12-project-review.md) · [Primeira publicação visual](docs/13-visual-release-v0.1.md)
- [Saldo cronológico](docs/14-time-credit-contract.md) · [Cenários de 0 a 8 bilhões e 1 trilhão](docs/15-population-scenarios.md)
- [Steam LIVE — integração oculta](docs/16-steam-live-signals.md) · [Issue #40](https://github.com/Faysk/world-pulse/issues/40)
- [Gestos e +1 segundo sem falsos cliques](docs/17-gesture-safety.md) · [Agregação espacial por zoom e benchmarks](docs/18-spatial-aggregation-spike.md)
- [Privacidade geográfica (protótipo isolado)](docs/20-geo-privacy-country-poc.md) · [Prévia de ranking ativo (branch da API)](https://github.com/Faysk/world-pulse/blob/feat/real-participation-api/docs/19-active-balance-ranking.md)

O reconhecimento de gestos do globo foi reforçado no [PR #47](https://github.com/Faysk/world-pulse/pull/47), integrado em `main`. A agregação de células por zoom e seu benchmark entraram como módulo **não ligado ao renderer** no [PR #49](https://github.com/Faysk/world-pulse/pull/49); a composição GPU multicolor continua na [issue #32](https://github.com/Faysk/world-pulse/issues/32).

O fluxo **interface → API → PostgreSQL descartável → dois navegadores** está validado em ambiente isolado ([issue #48 encerrada](https://github.com/Faysk/world-pulse/issues/48)), sem alterar a versão pública. O [PR #51](https://github.com/Faysk/world-pulse/pull/51) introduziu uma prévia de ranking por **saldo ativo** na branch experimental da API, com histórico e segundos separados. O [PR #52](https://github.com/Faysk/world-pulse/pull/52) acrescentou helpers de **país aproximado e supressão**, ainda sem conectar coordenadas/dados geográficos ao site. Próxima entrega: staging persistente, política RGPD/retention e validação segura de origem geográfica. Controles de custo/abuso e ordenação final do Top 10 seguem pendentes antes da alpha. O laboratório suporta até 756 células sintéticas; isso não comprova capacidade de atender bilhões de usuários reais.

[Issues](https://github.com/Faysk/world-pulse/issues) · [Milestones](https://github.com/Faysk/world-pulse/milestones) · Licença [MIT](LICENSE).
