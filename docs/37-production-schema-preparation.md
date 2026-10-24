# Migração de produção preparada, sem execução (#90)

`Production infrastructure` aceita a operação manual `migrate`, separada de
`check`, `sync` e `deploy`. **Não foi executada em produção nesta entrega.**
O default `WP_PRODUCTION_MIGRATIONS_ENABLED=false` no Environment production
recusa a operação antes de conectar o proprietário. Não há migração automática
por push, deploy, agendamento ou check de conexão.

## Guardas e destino

- Somente `main` de `Faysk/world-pulse`, checkout do commit exato do workflow.
- Flag de migração literalmente true e `WP_API_ENABLED` declarado false no GitHub.
  Antes de executar, o operador também deve conferir que a API implantada está
  desligada: mudar vars não altera deployments já existentes.
- `WP_PRODUCTION_DB_HOST` precisa ser o hostname pooled verificado da produção.
  A rotina de check autentica com TLS/role runtime e só então imprime **esse
  hostname não secreto**, sem conexão, usuário/senha ou token. O valor é salvo
  como var do Environment production, nunca deduzido de um hostname de staging.
- Runtime `world_pulse_app`, owner `neondb_owner` exclusivamente direto, mesmo
  banco `neondb`/endpoint atestado, TLS `verify-full`. Staging conhecido, host,
  role, porta ou SSL divergente são recusados. Credencial de owner só no passo
  deliberado de migração; não é sincronizada ao app/Vercel.

## Execução futura

Somente após os gates de homologação/privacidade/restore e a pausa de publicação
serem resolvidos, habilitar deliberadamente a flag e escolher `migrate`.
O workflow faz o probe normal de runtime/R2, aplica 0002–0006 na ordem e verifica
schema, leitura e atributos/memberships/permissões do runtime após fechar o owner.
Baseline 0001 já existe. Não cria senha, não altera o owner e não ativa UI/API.

Um advisory lock de sessão impede duas execuções simultâneas. Owner direto
preserva esse lock entre os commits; fechamento libera. Cada arquivo contém
sua própria transação. Falha interrompe os próximos arquivos e impede reportar
sucesso. **Não há rollback automático de arquivos já confirmados.** Registrar
qual foi aplicado, manter API desligada e revisar antes de retomar; arquivos
são idempotentes, mas isso não substitui backup/restore conferido. Não usar
DROP/DELETE para desfazer. Timeouts de statement/lock limitam a operação.

O resumo contém só arquivos, commit e confirmação de schema/runtime. Erros
privados são suprimidos. `migrate` não chama endpoints de sync, deploy ou promoção.
Depois de aplicar, voltar a flag para false e só então seguir a sequência de
liberação em [operações](32-prepublication-operations.md), com os gates próprios.

## Verificação desta preparação

Testes usam destinos/credenciais **fictícios** e conectores simulados: flag fechada
não conecta, API ativa/staging/TLS/roles/owner pooled recusados, ordem dos arquivos,
owner fechado antes do runtime, falha parcial sem falso sucesso e lock concorrente.
O SQL desses mesmos arquivos já foi aplicado no PostgreSQL descartável e no
staging real, mas **isso não é prova de migração executada em produção**.
