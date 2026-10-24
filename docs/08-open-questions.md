# 08 — Decisões abertas e premissas

**Não transformar suposições em requisitos confirmados.**

**Q1/Q2 resolvidas em 24/10/2026:** participação depende de saldo de tempo positivo por hashtag; diminui em tempo real, inclusive offline. Várias hashtags podem permanecer simultaneamente, mas novos taps aumentam somente a selecionada. O [contrato confirmado](14-time-credit-contract.md) substitui as alternativas antigas de Q1/Q2 abaixo. Q4 (ranking atual por saldo positivo) também foi resolvida; histórico começa na seleção. [Contrato atual](24-ranking-contract.md).

## Decisões de produto ainda abertas

### Q1/Q2. Participação e duração — resolvidas

Conta o participante por hashtag com saldo positivo. O saldo diminui em tempo real,
inclusive offline; histórico creditado permanece separado. Várias hashtags podem
ter saldo simultâneo; novos taps aumentam apenas a selecionada. Nenhuma presença
online ou seleção única elimina os saldos anteriores. [Contrato](14-time-credit-contract.md).

### Q3. Como interagir com o globo e com o +1 segundo?

Tap/click sobre planeta pode somar; drag/pinch devem navegar. E se tocar sobre **uma mancha colorida** para selecionar # — isso também soma no primeiro toque? Exige teste de UX.

### Q4. Qual métrica ordena o Top 10?

Resolvida: **qualquer hashtag entra, sem mínimo**; ordenação por participações atuais com saldo positivo. Ao zerar, sai do ranking e da mancha. Tempo não multiplica nem desempata a contagem. Histórico começa na seleção e é separado; máxima histórica não implementada. [Contrato](24-ranking-contract.md). Origem geográfica pública ainda depende de #6.

### Q5. O que é um "participante distinto" sem login?

Identificador persistente do navegador é uma aproximação: limpar storage, dispositivos diferentes ou vários browsers podem contar múltiplas vezes; não há garantia forte de pessoa humana única. Antiabuso pesado foi explicitamente **adiado**.

### Q6. Quanto detalhe geográfico?

Querer até bairro aproximado **não significa que IP possa identificar bairro**. Escolher resolução dinâmica conforme confiança de dados e risco de reidentificação.

### Q7. Sorteio de cores

Definir algoritmo de sorteio (paleta acessível vs random RGB puro), legibilidade, possibilidade de cores parecidas e unicidade — não exigir cor única para todo # do mundo.

### Q8. Histórico de cores

Tempo acumulado por hashtag deve permanecer. Para reconstrução temporal das manchas, snapshots agregados são possibilidade futura, não MVP obrigatório.

### Q9. Limites gratuitos e licenciamento de tiles

Confirmar quotas vigentes, terms of use, banco hibernado, acesso R2 e mapa base no momento de deploy. Manter infraestrutura $0 enquanto possível.

### Q10. Motor gráfico e transições

MapLibre GL é o motor efetivamente usado na POC publicada. A comparação de alternativas (#1) foi encerrada como não planejada, sem alegar benchmark comparativo. O aceite de desempenho em dispositivo físico (#12) continua pendente; não há motivo validado para uma migração agora.

## Critérios para decidir

Preferir **simplicidade de uso**, **honestidade geográfica**, **baixo custo**, **boa fluidez** e **separação entre segundos e pessoas**. Validar com protótipo, não reuniões intermináveis.
