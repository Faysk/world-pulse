# HTTPS privado contra o Neon staging real (#85)

O workflow manual `Staging database`, operação `smoke`, testa a experiência
integrada em dois navegadores contra o pooler Neon temporário real, sem Vercel.

```text
Chromium desktop/mobile emulado
  → HTTPS 127.0.0.1:4178 no runner Actions
  → mesmos handlers/store da API
  → TLS verify-full → pooler Neon world-pulse-staging
  → resposta, cookie e saldos no navegador
```

O servidor liga somente ao loopback; não cria endpoint público, túnel, domínio
ou deployment. Destino, banco, role, TLS e expiração são fixados pelo mesmo
validador de staging. Aceita apenas opt-in explícito em `codex/remote-staging`
de `Faysk/world-pulse`, rejeita proprietário e confere schema/atributos antes de
testar. Não migra. A conexão entra apenas no processo do passo de teste, nunca
em código cliente, arquivos `.env`, argumentos ou artefatos.

O certificado é efêmero/self-signed, chave privada no diretório temporário do
runner com umask 077. O navegador aceita esse certificado somente nesse teste.
Isso permite conferir contexto seguro, Web Locks e atributos Secure/HttpOnly/
SameSite do cookie real. **Não valida certificado público, runtime ou headers
da borda Vercel**, nem proxy/VPN no trajeto real. A conexão do banco continua
verificando certificado normalmente, sem ignore TLS no PostgreSQL.

Os testes criam apenas sessões e hashtags sintéticas: mesmo ID/cor em duas
sessões independentes, históricos 30/15, resposta perdida após commit e retry
mantendo 31 (não 32), outra hashtag com saldo separado, recarga e consentimento
real persistido com país `ZZ`. A fonte geográfica permanece desligada; localhost
não é tratado como borda confiável. Cartografia é fixture local para não depender
de tiles de terceiros nesse teste. Não é medição de FPS em hardware físico.

Traces e HAR ficam desligados para não registrar cookies de sessões reais do
staging. Artefatos contêm apenas screenshots da UI de teste. Atributos de cookies
são conferidos como booleanos; o valor da credencial não é impresso. Binding da
fila também não entra no relatório. Erros de driver/startup são suprimidos.

No encerramento normal, uma transação remove somente os IDs de visitantes que
esse processo criou e invalida a cache agregada. É limpeza de fixtures sintéticas
isoladas, não a manutenção dos históricos de participantes reais. Não há DELETE
amplo de visitantes, migração, owner ou acesso a produção. Tags vazias e contadores
de orçamento do teste podem permanecer na branch temporária; ela expira em
31/10/2026 01:15 UTC. SIGKILL/interrupção pode impedir cleanup, então a expiração
da branch é a proteção final, sem prometer limpeza garantida após crash.

O teste complementa PostgreSQL descartável, schema check e plano de preview.
O aceite do preview HTTPS público continua separado em #53, e origem real em #6.
