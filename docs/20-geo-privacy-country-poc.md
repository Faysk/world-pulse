# 20 — Privacidade geográfica: país aproximado e supressão (issue #6)

**Status:** protótipo puro + testes, **não conectado** ao banco, ao globo, aos visitantes ou à API pública. Nenhum IP foi lido nem persistido.

## Regras do primeiro corte

O World Pulse **não precisa de endereços ou geolocalização precisa** para atribuir uma origem ampla a uma hashtag. A entrada ideal vem dos cabeçalhos atribuídos pelo proxy da Vercel ao request, **na função server-side**.

- `x-vercel-ip-country` — dois caracteres; apenas país **estimado pelo IP**.
- Cidade, código postal, latitude/longitude e IP bruto são **ignorados e não retornados**.
- Ausência, valor inválido, fonte não confiável ou proxy à frente que prejudique a origem → país `ZZ`, granularidade `unknown`.
- Mesmo país aparentemente válido não prova que o visitante reside ali: VPN, operadora móvel e rede corporativa podem errar a estimativa.

O módulo `server/geoPrivacy.mjs` recebe metadados somente quando o chamador **explicitamente** confirma que vieram de um ambiente de borda confiável. Isso é apenas um contrato interno: um serviço HTTP real ainda precisa validar a proveniência da requisição na infraestrutura. Não aceitar `country`, `lat` ou `lng` de JSON enviado pelo cliente.

## Supressão de grupos geográficos pequenos

A função `suppressSmallCountryGroups()` atua em linhas que **já sejam contagens distintas** de participantes com saldo positivo, previamente agregadas no banco por hashtag e país. Ela jamais recebe registros de pessoas, IPs ou identificadores de sessão.

**Política provisória de apresentação:**

- País com **5 ou mais** sessões ativas numa hashtag: pode entrar como uma linha agregada de país.
- País com 1–4 sessões: não aparece nominalmente; soma no grupo amplo `OTHER`.
- Localização sem confiança: soma em `ZZ` (**desconhecida**), não inventar um ponto no globo.
- Em todos os casos, preservar as contagens inteiras de sessões **por hashtag**, sem usar segundos ou taps como pessoas.
- A regra de **sem limiar mínimo para as hashtags no Top 10** continua válida; a supressão é apenas de granularidade geográfica sensível.

Este limiar é uma **precaução de apresentação, não anonimização demonstrada**. As diferenças entre snapshots sucessivos podem permitir inferência mesmo com cinco pessoas. Antes da publicação, considerar agrupamentos temporais, atraso/cache, limiares adaptativos e avaliação RGPD. Consultas SQL deverão impor a agregação **antes** de retornar dados, não fazer downgrade apenas na interface.

## Fluxo pretendido (ainda não conectado)

```text
Vercel Function com request confiável
  → país IP aproximado ou ZZ
  → política de gravação mínima/retention (AINDA NÃO DEFINIDA)
  → agregado PostgreSQL: (tag, país, COUNT DISTINCT pseudônimo com saldo positivo)
  → supressão de grupos pequenos (no servidor)
  → resposta exclusivamente agregada
  → renderização ampla no globo, sem coordenadas individuais
```

**A consulta SQL de países, regras de retenção, autorização das origens e os renders do globo ainda são pendentes**. O módulo é uma peça isolada de validação do contrato, não uma feature pública.

## Referências consultadas

- [Vercel Geo-IP Headers — documentação](https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions) — país, região e cidade; dados de IP são aproximados, indisponíveis em dev local e inadequados atrás de proxy não confiável.
- [Vercel Request Headers](https://vercel.com/docs/headers/request-headers) — codificação e interpretação de campos IP.
- [European Data Protection Board](https://www.edpb.europa.eu/) — avaliar processamento de dados pessoais antes de produção.

## Testes automatizados

`node --test tests/geoPrivacy.test.mjs` verifica fonte não confiável, proxy/VPN implícitos (sem tratar país como prova de residência), cidade/postal/coords ignorados, `ZZ`, supressão, totais exatos, ausência de IDs pessoais, células pequenas e overflow.

### Ainda pendente para aceitar #6

- [ ] Confirmar origem dos metadados em deployment real **sem** devolver IP/cabeçalhos geográficos brutos ao público.
- [ ] Documentar justificativa RGPD/base legal, retenção, exclusão e medidas de segurança.
- [ ] Implementar e testar SQL agregado por país e viewport com supressão de geografia.
- [ ] Avaliar ataques por consultas diferenciais, VPN, IPv6, NAT de operadora e proxy.
- [ ] Zero publicação de coordenadas residenciais ou identificadores no globo, incluindo estados intermediários.
