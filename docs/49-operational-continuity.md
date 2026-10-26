# 49 — Continuidade operacional, consultas e recuperação

26/10/2026 · milestone v0.4 · issues #134, #135 e #136.

## Recursos e configuração

O staging Neon `world-pulse-staging` é schema-only e não expira automaticamente
desde 26/10. O endpoint continua fixado; nenhum dado de produção foi copiado.
O token Vercel `world-pulse-staging-actions-2026-10`, restrito a `world-pulse`,
vence em 24/01/2027 e está em `staging/VERCEL_TOKEN`. O check diário do Actions
exige renovação sete dias antes, usando `WP_PREVIEW_TOKEN_EXPIRES_AT`; não renova
credenciais sozinho. O prazo registrado é conservador (00:00 UTC).

Em produção há dois buckets R2 privados, Standard:

| Bucket | Função | Acesso |
| --- | --- | --- |
| world-pulse-production | Probes de infraestrutura | Credencial existente de runtime |
| world-pulse-backups | Arquivos de recuperação criptografados | Token próprio, Object Read & Write, somente esse bucket |

Secrets adicionais em GitHub Environment `production`:
`R2_BACKUP_ACCESS_KEY_ID`, `R2_BACKUP_SECRET_ACCESS_KEY`,
`WP_BACKUP_ENCRYPTION_KEY` (32 bytes aleatórios, base64). Variável de environment
`R2_BACKUP_BUCKET_NAME=world-pulse-backups`; gate de repositório
`WP_BACKUP_ENABLED=true` somente após revisão/testes. Nenhuma dessas três secrets
é sincronizada para a Vercel ou enviada ao navegador. A chave de criptografia
não pode ser relida no GitHub: não a substituir durante um incidente, pois isso
inutilizaria cópias anteriores. Uma futura custódia offline independente precisa
ser acordada; esta entrega depende da disponibilidade do GitHub e de suas secrets.

## Backup e teste de restauração

`infra-backup.yml`: execução manual ou diária, 04:17 UTC, apenas `main` e
Environment production. Usa somente `world_pulse_app`, conexão direta derivada
do endpoint exato de produção, TLS verify-full e CA do sistema. O proprietário
de migrations não entra nesse workflow.

1. Transação read-only com snapshot exportado. `pg_dump` custom da imagem oficial
   postgres:18 usa o mesmo snapshot; aceita servidor 14–18. O inventário de oito
   tabelas é conferido e alterações de schema desconhecidas exigem revisão.
2. Preserva tags, sessões, saldos, lotes idempotentes e totais históricos.
   Exclui apenas os dados de caches regionais/países e budgets temporários;
   suas tabelas continuam no arquivo.
3. Criptografa em memória com AES-256-GCM, nonce aleatório, cabeçalho autenticado,
   SHA-256 do dump e manifesto privado. Só o ciphertext é enviado ao R2.
4. Outro passo, sem DATABASE_URL, baixa o objeto remoto, autentica/descriptografa
   e executa pg_restore num PostgreSQL descartável, sem rede, sem porta publicada,
   dados em tmpfs e logs de container desativados.
5. Confere contagens e fingerprints de todas as cinco tabelas duráveis no mesmo
   snapshot, constraints validadas e caches/budgets vazios. MD5 ordenado serve
   apenas à comparação de conteúdo; GCM/SHA-256 fazem a autenticação/integridade.
6. Só após sucesso grava `.verified.json` com recibo não pessoal e remove objetos
   próprios com mais de sete dias. Falha antes dessa etapa preserva os backups
   existentes; a falha precisa ser atendida para não prolongar retenção.

Limites internos: dump comprimido de até 64 MiB, envelope até 90 MiB,
no máximo três exportações por 24h, inventário até 1000 objetos e orçamento
preventivo de 1 GiB no prefixo `daily/`. Não são quotas do provedor. Sem upload
de dados para artifacts do Actions, sem dump em disco e sem copiar para staging.
`infra/backup-fixture.mjs` testa o caminho real pg_dump → criptografia → pg_restore
com schema 0001–0008 e dados sintéticos não vazios no CI, sem secrets da nuvem.

É uma cópia lógica diária, não PITR nem cópia de roles/cluster inteiro. RPO alvo
24h, condicionado ao último sucesso; RTO ainda não medido. Não há operação que
sobrescreva produção. Em desastre: identificar último recibo verificado, preparar
um destino novo, revisar schema/roles/grants atuais, restaurar e executar smoke,
aplicar retenção/retirada de localização ocorridas desde a cópia e só então
planejar troca de conexão. Nunca executar uma restauração antiga diretamente
sobre produção nem republicar localizações retiradas entre backup e incidente.

A ajuda pública EN/PT/ES informa retenção adicional das cópias criptografadas e
possível atraso em falhas de manutenção. Não promete anonimato ou apagamento
instantâneo de cópias antigas.

## Consultas e custos

O Top 10 não consulta enquanto fechado, inclusive após seleção/taps/foco.
Ao abrir, faz leitura imediata e segue a cada cinco segundos. Países já consultam
somente com seu painel aberto; regiões continuam atualizando o mapa visível.
Sem painéis, elimina até 12 requests de ranking/minuto por aba (até 17.280/dia
se ficar visível 24h). Com feed regional ativo, baseline teórico cai de 24 para
12 GETs/minuto; isso não representa CU, leituras SQL, fatura ou teste de carga.
Abas ocultas suspendem polling. O teste de navegador conta requests reais
interceptados e verifica fechar/reabrir no desktop e mobile.

`infra-usage.yml` gera relatório manual read-only: versão/tamanho do banco,
estimativas por tabela e contadores globais de budget. Nunca publica IDs de
sessão, células, coordenadas ou linhas pessoais. Contadores de budget não são
telemetria financeira. Métricas de conta R2 incluem outros projetos, portanto
não podem ser atribuídas automaticamente ao World Pulse.

Nenhuma ampliação de plano. Confirmar quotas nos painéis antes de ampliar tráfego;
backups e polling consomem armazenamento, operações, transferência e compute.

Fontes: [Neon branches](https://neon.com/docs/manage/branches),
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html),
[R2 tokens](https://developers.cloudflare.com/r2/api/s3/tokens/).

## Recibos

Os links dos testes remotos e da primeira cópia verificada serão registrados
neste documento antes de encerrar #134–#136. Recursos provisionados ou testes
unitários não bastam para declarar restauração de produção verificada.
