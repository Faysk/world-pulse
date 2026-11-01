# 57 — Network Pulse: primeira superfície pública

01/11/2026 · #164 · milestone v0.4.

## Entregue

`/network/` é uma entrada estática própria, com canonical e metadados, no mesmo
build e publicação manual pelo Actions. A navegação da participação oferece
`Network`; o retorno preserva a separação conceitual. O modo não inicializa
sessão, pede geolocalização ou chama endpoints de participação.

Interface neutra, responsiva, EN (padrão) / PT (seleção ou link da participação),
12 recortes incluindo mundial, e janelas móveis 24 h / 7 d / 30 d. Filtros ficam
na URL para compartilhar/reabrir. O globo vazio acompanha o recorte geográfico;
não pinta valores inexistentes, não representa tráfego nem contém usuários
simulados. Sem WebGL, seleção e gráfico permanecem independentes.

## Dados reais disponíveis agora

O gráfico interativo **TrafficVolumeXY**, fornecido pelo Cloudflare Radar,
mostra variação relativa ao período anterior. URL e parâmetros foram lidos no
diálogo oficial Share, com Portugal/24 h em 01/11/2026:
`https://radar.cloudflare.com/embed/TrafficVolumeXY?theme=dark&dateRange=1d&location=pt&ref=%2Ftraffic%2Fpt`.

Preservamos legenda, escala, horário, atribuição e link da fonte. O evento
`iframe.onload` significa apenas que o documento carregou: não atesta séries
disponíveis, atualizadas ou livres de desafio/bloqueio. Sempre há link externo
e recarregamento manual; não simulamos sucesso nem lemos iframe cross-origin.
Não há polling próprio nem credenciais nesta etapa. Provedor pode mudar o
contrato ou indisponibilizar a incorporação.

O embed oficial é disponibilizado sob CC BY 4.0 e coleta métricas de uso com
Cloudflare Web Analytics; isso é informado em Fontes e método. O navegador
conecta diretamente à Cloudflare. Não enviamos sessão do app ou coordenadas,
e o iframe usa no-referrer. Licença dos **dados da API** é diferente (CC BY-NC
4.0); esta entrega não extrai nem redistribui esses dados.

AMS-IX Amsterdam e DE-CIX Frankfurt são links para observações oficiais,
não feeds incorporados, não pontos com valores medidos pelo World Pulse.

## Interpretação e limites

- Radar cobre a visibilidade Cloudflare, não toda a internet.
- ASN Microsoft não é sinônimo de Xbox; Sony/CDNs não isolam um jogo.
- Variação não demonstra causalidade; não há contador de downloads GTA VI.
- Não somar exchanges, direções de tráfego ou unidades incompatíveis.
- Não há arquivo histórico próprio, baseline estatístico, intervalo de
  previsão, estudo causal ou integração de parceiros nesta entrega.
- Filtros de janela móvel não são seletor de datas históricas independentes.
- Não atribuir horário de fetch do app ao horário da medição da fonte.

## Próxima evolução

Piloto de ingestão versionada com licença verificada, amostras e metadados de
normalização/cobertura; comparação conjunta de janelas; testes em eventos
passados e períodos placebo. Só então publicar desvios calculados pelo World
Pulse. Recepção de CSV/JSON agregado de parceiros exige contrato e validação;
nenhum parceiro foi contatado ou credencial criada nesta etapa.

## Verificação

`npm run check`: testes de contrato e build passaram; SQL remoto não executado
localmente (sem mudanças de banco). Playwright: 2/2 cenários novos passaram,
Chromium desktop e Pixel 7 emulado. Gráfico real mundial/7 d observado no Chrome
com legenda Total bytes / HTTP bytes / HTTP requests, escala percentual e
horário da fonte 01/11/2026 17:15 UTC. Isso não garante disponibilidade contínua.

Contrato de filtros/URLs, canonical/gate de indexação e build. Navegador desktop
e mobile verifica navegação, recarga, idioma, ausência de requests `/api/` e
overflow com iframe controlado. O fixture é apenas teste de UI e não evidência
de disponibilidade externa. A incorporação real é verificada separadamente no
navegador; seu conteúdo permanece sob responsabilidade da fonte.

## Fontes primárias

- https://developers.cloudflare.com/radar/get-started/embed/
- https://radar.cloudflare.com/about#licensing-policies
- https://developers.cloudflare.com/radar/investigate/netflows/
- https://developers.cloudflare.com/radar/concepts/normalization/
- https://stats.ams-ix.net/
- https://www.de-cix.net/en/locations/frankfurt/statistics
