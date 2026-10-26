# 53 — Recuperação do serviço e custódia independente

26/10/2026 · #138 · milestone v0.4.

## O que o ensaio prova

O job `recovery-service` usa PostgreSQL descartável e somente dados sintéticos.
Cria schema 0001–0008, sessão, saldo ativo e expirado, lote idempotente e histórico
grande. Verifica a API HTTP real, exporta/encripta/desencripta, restaura em **outro
banco**, compara fingerprints e aplica `infra/recovery-policy.mjs` antes do corte.
Remove o banco de origem descartável para provar que não existe fallback.

No destino: runtime sem DDL, sessão e ranking retornam; lote antigo não duplica
créditos; lote novo funciona; saldo expirado não revive; histórico mantém precisão.
Todo país, célula, timestamps de consentimento e caches recuperados são removidos.
O ponto só reaparece após autorização nova, e a retirada volta a removê-lo.
Saldos e histórico são preservados; expiração usa relógio real, sem congelar tempo.

O artifact contém apenas tempos, tamanho criptografado e nomes fixos de checks.
Não contém dump, chaves, cookies, IDs de sessão ou células. O script recusa secrets
cloud e só admite nomes de bancos e endereço loopback fixos. Não executa em Neon
nem sobrescreve produção. Os tempos acumulados são **ensaio local sintético**,
não RTO de Vercel, DNS, conta perdida, operador ou dados maiores.

## Corte real, quando necessário

1. Declarar incidente e suspender writes/publicação antes de trocar destino.
   Preservar o último backup verificado e os recibos; registrar seu horário.
2. Recuperar acesso ao provedor e à chave pelo gerenciador de senhas independente
   escolhido pelo proprietário. Nunca copiar chave para chat, issue ou artifact.
3. Criar destino novo, owner separado e runtime `world_pulse_app` sem memberships,
   DDL ou permissões administrativas. Restaurar como owner com no-owner/no-acl.
4. Comparar fingerprints das cinco tabelas duráveis **antes** de qualquer alteração.
   Conferir constraints, versão/schema e exclusão dos caches/budgets transitórios.
5. Executar a política de privacidade e grants revisados no destino novo. Aplicar
   a baseline de default privileges para futuras migrations; conferir runtime/TLS
   verify-full. Nenhuma localização/consentimento antigo pode ser republicado.
6. Guardar novas conexões runtime/owner no Environment correto do GitHub, conferir
   o alvo permitido pelos guards de infra e produzir release revisada. Os guards
   fixam hosts atuais: um host novo exige atualização explícita e testes, não
   contorno ou desativação da validação. Testar sessão/taps/replay/expiração e
   retirada em acesso privado antes de promover.
7. Promover o mesmo candidato verificado, conferir HTTPS/assets/API no domínio e
   reativar writes gradualmente. Se houve novas escritas no destino, não voltar
   ao banco antigo sem reconciliação: isso perderia dados/dividiria autoridade.
8. Reativar e testar backup/retention do novo alvo. Guardar horários do incidente,
   último backup, recuperação de acesso, restore, validação e promoção.

RPO é a distância até o **último backup verificado**, não até a última tentativa.
A agenda é diária; falhas podem alongar o intervalo. Writes confirmados depois
da cópia podem ser perdidos. Recuperação pontual do provedor e export diário são
mecanismos diferentes. Não prometer RPO/RTO financeiro sem ensaio real medido.

## Chave independente — escolha do proprietário

O proprietário escolheu seu gerenciador de senhas. A secret atual do GitHub não
pode ser relida pela API; não há prova de cópia externa dessa chave. Não marcar
custódia concluída nem substituir a atual antes de verificar uma nova cópia.

Procedimento de rotação em duas fases, sem interromper o backup atual:

1. Criar entrada privada no gerenciador com chave de 32 bytes aleatórios em Base64
   (44 caracteres terminando em `=`), junto de projeto, bucket, data e instruções
   de recuperação. Se precisar gerar localmente no PowerShell 7, este comando
   envia à área de transferência sem imprimir no terminal:

   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) | Set-Clipboard
   ```

2. Guardar o mesmo valor como **WP_BACKUP_NEXT_ENCRYPTION_KEY**, somente no
   [GitHub Environment production](https://github.com/Faysk/world-pulse/settings/environments).
   Não usar repository variable ou arquivo versionado. A chave atual continua ativa.
3. Executar `Encrypted database backup` manualmente com `key_slot=candidate`.
   Ausência/valor inválido da candidata falha fechado; não recorre à atual.
   Exigir sucesso de upload, readback, autenticação GCM e restore isolado.
4. Só depois do sucesso, promover o valor já guardado no gerenciador para
   **WP_BACKUP_ENCRYPTION_KEY**. Executar com `key_slot=current` e exigir sucesso.
   Registrar somente recibos e datas, nunca valores. Remover a secret NEXT após
   confirmar; manter ambas as chaves no gerenciador enquanto houver backups que
   dependam delas. Se a chave antiga não está disponível, documentar que cópias
   antigas não serão recuperáveis após a troca; não apagá-las antecipadamente.

Esta etapa depende de o proprietário guardar/confirmar a entrada no gerenciador.
Um job verde com chave apenas no GitHub não comprova custódia independente.

## Expiração independente

A limpeza atual remove objetos com mais de sete dias **após** verificar uma cópia
nova. Durante falha prolongada pode conservar antigos; o aviso público já expõe
esse atraso. Regra R2 `daily/` com expiração por idade poderia atuar sem o Actions,
mas também apagaria a última cópia recuperável durante uma falha longa.

Antes de ativar uma regra destrutiva no provedor, confrontar esses dois objetivos
e medir o comportamento no bucket de teste. Não declarar lifecycle independente
ativo sem ler/aplicar/verificar a configuração real. A custódia externa, o corte
cloud/DNS e essa decisão permanecem rastreados em #138.
