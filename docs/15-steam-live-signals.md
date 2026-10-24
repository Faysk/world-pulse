# World Pulse — Steam LIVE (primeira fonte externa real)

**Estado:** POC isolada, branch `feat/steam-live-signals`. Sem mudanças em participantes, geografia ou persistência do World Pulse.

## Por que esta integração existe

Queremos mostrar que o produto consegue consultar **dados externos reais**, mesmo antes da participação própria estar disponível. A Steam é uma fonte conveniente para informações de jogadores simultâneos **por jogo**, com dados oficiais e sem procurar identificar pessoas.

**O painel STEAM LIVE é um feed externo**, não o ranking oficial de hashtags, não o número de participantes do World Pulse e não a quantidade global de todos os jogadores Steam.

## Fonte e âmbito exato

- Steamworks Web API: [`ISteamUserStats/GetNumberOfCurrentPlayers/v1/`](https://partner.steamgames.com/doc/webapi/ISteamUserStats)
- Host público: `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=<appid>`
- O método devolve **jogadores conectados atualmente à Steam para determinado AppID**. Não abrange jogadores desconectados da Steam nem jogadores em PlayStation, Xbox, Epic etc.
- A lista de **16 AppIDs** é inicialmente escolhida manualmente e versionada em `server/steam.mjs`. A ordenação é **apenas entre os 16 jogos monitorados**.
- Não inferimos o Top 100 absoluto da Steam. Novos jogos populares não entram automaticamente nesta primeira etapa.
- Nenhuma informação de país, cidade ou IP individual é retornada. **Jamais transformar esse número em luzes geográficas**.

## Fluxo técnico

```
visitante clica "STEAM LIVE"
    ↓
GET /api/steam
    ↓ Vercel Node function
consulta oficial em paralelo para 16 IDs conhecidos
    ↓
valida resposta result=1 e número >=0
    ↓
ordena somente as respostas válidas
    ↓
devolve {source,scope:"curated_sample",capturedAt,monitoredGames,successfulGames,games}
    ↓
painel mostra contagem e origem, e links Steam Store
```

- A função é **GET-only**, sem Steam API key e sem secrets enviados ao navegador.
- Respostas de sucesso têm `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, para evitar executar consultas da Steam por visita.
- Timeout por consulta: 4,5 segundos. Se um jogo falhar, **é omitido**, com cobertura explícita (`successfulGames/monitoredGames`). Se todos falharem, HTTP 502 sem valores fictícios.
- O navegador só busca dados **ao abrir o painel**, sem polling constante; botão ↻ reconsulta o endpoint, sujeito ao cache da CDN.
- Todos os nomes, IDs e URLs vêm de lista do código da API. Usuário não pode indicar AppID arbitrário via este endpoint.
- O componente visual fica recolhido por padrão em desktop e mobile e não modifica o WebGL, nem faz re-render da camada de mapa ao receber dados.

## Critérios de aceite

- [ ] Em preview Vercel, `GET /api/steam` responde com contagens Steam oficiais e carimbo de atualização, não com fixtures.
- [ ] No navegador, o botão STEAM LIVE abre o painel sem cobrir o globo por padrão.
- [ ] Desktop e mobile aprovados no smoke Playwright com respostas mockadas (incluindo indisponibilidade 502).
- [ ] Dados externos e dados simulados visualmente diferenciados.
- [ ] POC `+1 segundo/tap` e as manchas permanecem invariantes quando a Steam muda.
- [ ] Exibir amostra de jogos, nunca afirmar ranking completo sem consulta oficial de Top 100.
- [ ] Performance e quotas observadas antes de produção. Se Steam estiver fora, exibir indisponibilidade.

## Futuro, sem adiantar trabalho desnecessário

1. Integrar catálogo `IStoreService/GetAppList` com credencial server-side e atualização incremental. API tem filtro jogos/DLC e paginação; não é ideal fazer scan inteiro no navegador.
2. Consultar ranking global Steam Charts (avaliar `ISteamChartsService` e documentação/estabilidade) para descobrir novos jogos automaticamente.
3. Guardar snapshots compactos no PostgreSQL (sem necessidade inicial de R2), mostrando histórico 1h/24h/7d.
4. Sugerir # populares com base em Steam, mas **criar luzes apenas quando alguém participar realmente do World Pulse**.

Esta feature não precisa nem ativa a [API experimental de participação real](https://github.com/Faysk/world-pulse/pull/31).
