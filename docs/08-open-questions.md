# 08 — Decisões abertas e premissas

**Não transformar suposições em requisitos confirmados.**

**Q1/Q2 resolvidas em 24/10/2026:** participação depende de saldo de tempo positivo por hashtag; diminui em tempo real, inclusive offline. Várias hashtags podem permanecer simultaneamente, mas novos taps aumentam somente a selecionada. O [contrato confirmado](14-time-credit-contract.md) substitui as alternativas antigas de Q1/Q2 abaixo. Q4 (ordenação do ranking) permanece aberta.

## Decisões de produto ainda abertas

### Q1. O que conta como participante para a mancha?

- **Seleção atual** de uma hashtag?
- Quem já **clicou pelo menos uma vez** nela?
- **Todos que já contribuíram historicamente**?

**Impacto:** persistência e tamanho das manchas. Consenso atual: **pessoas distintas, nunca número de cliques**. Critério de ativo/histórico ainda indefinido.

### Q2. Quando a cor enfraquece ou desaparece?

Pode haver expiração de presença visual após fechar site, mas a intenção expressa é **preservar os segundos pelo tempo que a pessoa conseguir clicar**, inclusive entre hashtags. Não inferir retenção temporária dos segundos a partir de eventual expiração da presença.

### Q3. Como interagir com o globo e com o +1 segundo?

Tap/click sobre planeta pode somar; drag/pinch devem navegar. E se tocar sobre **uma mancha colorida** para selecionar # — isso também soma no primeiro toque? Exige teste de UX.

### Q4. Qual métrica ordena o Top 10?

Confirmado: **qualquer hashtag entra, sem mínimo de pessoas**; mostrar origem geográfica. Definir se ranking ordena por pessoas distintas atuais, pessoas históricas ou segundos.

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

MapLibre, Globe.gl, CesiumJS e shaders GPU são candidatos, não seleção definitiva. Criar benchmark e registrar decisão após evidências.

## Critérios para decidir

Preferir **simplicidade de uso**, **honestidade geográfica**, **baixo custo**, **boa fluidez** e **separação entre segundos e pessoas**. Validar com protótipo, não reuniões intermináveis.
