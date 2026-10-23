# 05 — Arquitetura e limites gratuitos

**Status:** preferência de serviços definida; nenhum projeto de infraestrutura criado por esta documentação.

## Componentes escolhidos como preferência

| Serviço | Papel planejado | Notas |
|---|---|---|
| **Vercel Hobby** | Frontend React/Next.js e, se necessário, endpoints leves | Não jogar evento de cada toque na Function; separar build estático de API quando possível |
| **Cloudflare DNS** | Domínio e DNS | Modo proxy on/off interfere no IP/geolocalização visto pela Vercel; testar |
| **Cloudflare R2** | Capturas, assets próprios, snapshots agregados e arquivo histórico caso faça sentido | Não usar como banco de tempo/presença nem presumir que cabe hospedar todos os tiles do planeta |
| **Supabase Free (Postgres)** | Hashtags, cores persistidas, identificadores pseudônimos, contribuições e agregados | Banco deve registrar cliques idempotentemente por lotes; RLS e acesso mínimo |
| **Provedor de tiles a validar** | Dados cartográficos neutros para globo | Testar política de uso e disponibilidade (ex.: OpenFreeMap); sem planos pagos obrigatórios |
| **H3 (biblioteca)** | Indexação e agregação espacial | Não é serviço cobrado, calcular célula no servidor e granularidade na visão |

## Limites — não codificar números fixos sem checagem

Planos gratuitos mudam. Antes do deploy e periodicamente conferir:
- [Vercel Limits](https://vercel.com/docs/limits) e [Pricing](https://vercel.com/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare DNS](https://developers.cloudflare.com/dns/)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [OpenFreeMap](https://openfreemap.org/)

Verificar especialmente **invocações, banda/egress, armazenamento, conexões simultâneas, chamadas e políticas de hibernação/pausa**. Este projeto não prevê monetização e deve evitar custos automáticos.

## Principal risco de custos

Cada tap conta +1, **mas não deve necessariamente virar uma chamada HTTP**.

Solução proposta:
- Incrementar contador no cliente imediatamente.
- Acumular `pending_clicks` e enviar em **lotes periódicos** e no evento de saída quando possível.
- Cada lote com ID único e número de taps; backend aplica uma única vez (idempotência).
- Tratar falhas/reenvios; persistência local antes da confirmação do servidor.
- Não prometer recuperação garantida se pessoa fechar sem sincronizar ou apagar o armazenamento.
- Realtime: evitar 1 WebSocket público por visitante no plano gratuito; considerar polling de **agregados/cache** e atualizações de alguns segundos, ou broadcast eficiente para upgrade futuro.
- Exibir dados agregados por células, não milhões de posições de participantes.

## Esboço de arquitetura

```text
Navegador
  ├─ React + motor 3D a escolher
  ├─ Seleção de # e taps (+1 por tap local)
  ├─ Buffer de contribuições + sync em lote
  └─ Fetch/poll de agregados de manchas e Top 10
        |
        v
Vercel (site e API leve)
  ├─ Geolocalização aproximada da requisição
  ├─ Validação de hashtag/cor
  ├─ Idempotência de lotes (+N segundos)
  └─ Consulta agregados
        |
        +----> Supabase/PostgreSQL
        |
        +----> Cloudflare R2 (somente se necessário)
        
Cloudflare DNS -> domínio
Tiles cartográficos -> provedor separado, condicionado à licença
```

## Segurança mínima (mesmo em protótipo)

- Nunca enviar chave `service_role` do Supabase ao browser.
- Preferir endpoints server-side para inserções; credenciais em segredos Vercel.
- RLS e grants explícitos para tabelas expostas; não dar escrita indiscriminada aos clientes.
- Não registrar IP bruto em logs de uso/analytics sem necessidade.

## Critérios de sucesso

- Protótipo implantável usando os planos gratuitos, sem custo recorrente.
- Orçamento de requisições e egress medidos durante simulação 10 / 100 / 1.000 usuários.
- Nenhum endpoint de tap gera atualização global para todos os visitantes.
- Uso de R2 somente quando houver benefício concreto.
