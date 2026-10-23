# 12 — Revisão crítica e próxima entrega

Revisão de 23/10/2026, baseada em `main` (`a6f9f20`) e PR #14 (`4049ec5`). **Recomendações de produto abaixo são propostas, não decisões aprovadas.** Rastreio: #20 e #21.

## O que mais destrava o projeto

O próximo salto útil é um fluxo real pequeno: dois navegadores usam a mesma hashtag e cor, enviam lotes sem duplicar segundos e consultam um agregado. Ele valida as principais regras antes de investir em shaders ou escala global. O trabalho visual do PR #14 pode seguir com dados simulados em paralelo, sem exigir backend pronto.

| Prioridade | Achado | Ação |
|---|---|---|
| P0 | Presença e ranking indefinidos (#9/#8) impedem um contrato estável | Resolver as definições antes de migrations de domínio; proposta abaixo |
| P0 | #4 em v0.2 depende de persistência tratada em v0.3 | Tratar #20 como contrato do corte vertical e usar a infra já pronta; milestones não devem impor uma ordem impossível |
| P1 | Deploy tinha apenas testes de infraestrutura | Novo job sem secrets exige lockfile, testes e build do app antes do job de produção (#21) |
| P1 | CI do PR #14 usa `npm install`, sem lockfile no commit revisado | Adicionar lockfile e usar `npm ci`; versões transitivas também precisam ser reproduzíveis |
| P1 | #1/#2/#10/#11/#12 repetem validação visual e acumulam checklists históricos | Usar #12 como relatório único de evidência; manter #1 para decisão de motor, #2/#10 para experimentos específicos |
| P1 | Pontos simulados detalhados não demonstram privacidade de dados reais | Agregar no servidor; nunca ampliar resolução de pessoas só porque o visitante deu zoom |

## Escopo visual: reduzir pesquisa sem fingir aprovação

MapLibre já tem uma implementação e testes de navegador. Recomendo mantê-lo como candidato principal **condicional** e só prototipar outro motor se ele falhar nos critérios de nitidez, interação ou desempenho. Comparar três implementações completas antes de validar uma pode virar pesquisa sem fim. Isso requer concordância com o escopo da issue #1, não significa declará-la concluída.

Para #12, começar por matriz pequena: desktop e um celular físico, mundo/país/cidade, mapa real, zero atividade e carga representativa de células. Registrar dispositivo, navegador, commit, duração de navegação, frame times, bytes e falhas. Meta inicial proposta: interação utilizável com pelo menos 30 FPS sustentados no dispositivo móvel escolhido, buscando 60; não inferir resultado de GPU real a partir do Chromium emulado do CI.

Contar um milhão de pessoas em poucas células não equivale a renderizar um milhão de pontos. Medir número de células/features, hashtags simultâneas e camadas, além do total representado. Não prometer escala para milhares de hashtags com um heatmap por hashtag. Também não implementar shader próprio antes de medir o gargalo real.

O smoke atual intercepta cartografia com estilo artificial: é útil para regressão de interação, mas não prova nitidez ou disponibilidade do provedor. A [documentação OpenFreeMap](https://openfreemap.org/quick_start/) mostra a integração vetorial e atribuições. Confirmar atribuição visível e comportamento com rede lenta no estilo efetivo usado.

## Proposta para destravar #9 e #8

- Um participante do MVP é uma identidade de navegador emitida/validada pelo servidor; não uma pessoa humana comprovada. Não usar fingerprint para tentar resolver isso.
- Selecionar uma hashtag muda seleção; o primeiro tap elegível inicia participação visual. Toque que apenas seleciona outra hashtag não credita tempo. Isso segue a distinção da POC, mas precisa virar regra explícita de produto em #3.
- Presença ativa proposta: uma hashtag selecionada, pelo menos um tap nela e sinal de atividade recebido nos últimos cinco minutos. Renovação proposta a cada 60 segundos enquanto página visível; fechamento não depende de `unload` chegar. Decidir se troca para uma hashtag ainda sem tap retira imediatamente a presença anterior — recomendação: sim.
- Ranking e manchas usam a mesma presença ativa; segundos permanecem acumulados separadamente. Empates do ranking precisam de critério estável. Histórico não mantém presença indefinidamente.
- Esses tempos são parâmetros iniciais de experimento, não requisitos finais. Um heartbeat/minuto gera aproximadamente 60 mil requisições/hora com mil visitantes ativos, além dos lotes. Medir antes de liberar; combinar heartbeat com sync quando possível e não abrir Realtime por visitante no primeiro corte.

Uma pessoa alternando abas ainda deve ter uma seleção global consistente no servidor. Lote atrasado de A precisa creditar A após selecionar B, sem recriar presença de A. O frontend mantém uma seleção para novos taps; o servidor valida atribuição original, idempotência e limites. #20 registra esse caso, que evita perder tempo legítimo ao trocar de hashtag.

## Geografia: evitar precisão fabricada

Precisão do mapa e precisão dos participantes são coisas diferentes. O mapa pode ter ruas nítidas; os dados reais não devem virar pontos residenciais. IP pode indicar país/cidade estimados, não comprova bairro nem residência. Os [headers de requisição da Vercel](https://vercel.com/docs/headers/request-headers) são contexto do provedor; validar no backend implantado, nunca aceitar headers de localização arbitrários do browser como prova.

Sugestão inicial: país e região/cidade aproximada quando confiáveis; sem sinal, `unknown`. Para manchas públicas, estudar supressão de células com grupos pequenos ou agrupamento em região maior; um limiar como cinco é apenas proposta e não garante anonimato. Consultas sucessivas e diferenças entre snapshots também podem revelar entradas/saídas. O requisito visual de “uma pessoa acende um ponto” pode entrar em conflito com privacidade em locais pouco povoados; resolver isso em #6 antes de usar dados reais. A confirmação local de participação pode existir sem publicar uma célula individual.

## Custos e complexidade que eu adiaria

R2 está pronto, mas o fluxo mínimo de hashtags/taps não precisa de arquivos. Não adicionar snapshots, uploads ou distribuição de tiles só para usar o serviço. Objetos privados continuam privados até existir necessidade de produto.

Evitar Redis, cron de presença, WebSockets por visitante e materializações complexas no começo. Presença pode ser consultada por `last_seen_at` com índice e TTL lógico, sem job que apague linhas a cada minuto. Retenção física de lotes é outra decisão: apagar IDs de idempotência cedo permite que retries antigos sejam creditados novamente. Definir janela aceita e rejeição de lotes expirados antes de implementar limpeza.

Antiabuso sofisticado continua adiado, mas limites básicos de payload, tamanho de hashtag, tamanho de lote e frequência da API fazem parte da implementação mínima. Não aceitar `tap_count` ilimitado porque o cliente é uma POC.

## Release e integração dos PRs

A correção de #21 exige testes/build do app sem secrets antes de acessar `production`. Ainda não é uma publicação atômica: o build remoto da Vercel é posterior e o HTTP 200 ocorre após atribuição do domínio. Uma evolução separada deve validar deployment de produção sem domínio e promover depois, com teste da versão exata. Não alegar que o pipeline atual já faz isso.

O PR #14 adiciona `.gitignore` e `vercel.json`, também criados no PR #19. Resolver os conflitos preservando tanto o build Vite quanto `git.deploymentEnabled.main = false`, para que produção continue controlada pelo Actions. Não misturar dados reais ao laboratório visual nem fechar #12 apenas por CI verde.

Ordem recomendada: revisar mapa real e dispositivos em #12; resolver definições de #9; implementar contrato/sessão em #20; entregar #4/#5; adicionar agregados geográficos e ranking em #6/#8; validar o fluxo completo em #13. A publicação visual de #15 pode ocorrer antes do backend, desde que a simulação permaneça identificada e o frontend esteja aprovado.
