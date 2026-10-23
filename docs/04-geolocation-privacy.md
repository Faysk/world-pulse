# 04 — Geolocalização aproximada e privacidade

**Status:** intenção definida; nível de precisão e provedores a validar.

## Requisito

O visitante **não preenche localização**. O backend estima automaticamente sua área geográfica e associa a participação a uma região **ampla**, suficiente para perceber país/cidade e idealmente bairro aproximado **quando houver confiança**, sem permitir inferir casa, rua específica ou ponto exato.

**Não pedir GPS do navegador nesta fase.** Usar geolocalização aproximada por IP no servidor. Isso é uma inferência imperfeita: uma VPN, operadora móvel ou provedor podem apontar cidade/país errados.

## Proposta de fluxo

1. Request chega à infraestrutura (Vercel; Cloudflare pode fornecer metadados se a requisição passar pelo proxy adequado).
2. Extrair localização aproximada do IP (país, região, cidade, coords aproximadas quando disponíveis).
3. Validar qualidade/confiança; **não inventar bairro** a partir de dados de precisão apenas municipal.
4. Converter para uma célula/região ampla (ex.: H3 em resolução a ser calibrada) e **não persistir lat/lng individual exato**.
5. Enviar ao cliente apenas dados geográficos **agregados por hashtag/célula**, não registros de participantes identificáveis.
6. Se houver apenas país, contabilizar na origem nacional e tratar visualização em nível menos preciso; nunca falsificar um ponto fino.
7. Se não houver localização confiável, contribuir para estatísticas globais sem forçar ponto geográfico inventado.

## Critérios de privacidade

- Ninguém deve identificar a residência de outra pessoa pelo mapa.
- Um único participante numa área não deve ser exibido em coordenadas de origem; testar desfoque/célula e eventual limiar de detalhamento visual. Esse cuidado mínimo é diferente de filtros de produto ou sistema antiabuso.
- Não incluir IP bruto em payloads públicos, analytics ou logs desnecessários.
- Endereço IP, IDs persistentes e localização podem ser **dados pessoais** sob RGPD mesmo sem nome; elaborar aviso e base legal antes do público.
- Definir retenção e direitos do titular antes de produção. Segundos de contribuição podem ser armazenados por longo prazo, mas dados de localização individual não precisam seguir mesma retenção.
- Ao contar "pessoas", reconhecer a limitação da identidade anônima: na prática são participantes/dispositivos reconhecidos, sem comprovar pessoas reais únicas.

## Testes

- Cidade/país corretos em diferentes redes e smartphones.
- VPN, proxy, IP corporativo, IPv6 e metadados ausentes.
- Celular com rede móvel em regiões diferentes.
- Acesso ao mesmo projeto via Vercel com Cloudflare DNS/proxy: confirmar de onde chegam metadados (não presumir `request.cf` em funções Vercel).
- Zoom extremo: nunca tornar possível identificar endereço real.

## Referências

- [Vercel geolocation](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#geolocation)
- [Cloudflare request.cf](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties)
- [RGPD/EDPB](https://www.edpb.europa.eu/)
- [H3](https://h3geo.org/docs/)
