# 30 — Publicações deliberadas e cota de builds

Atualização de 24/10/2026, relacionada a #7 e #53.

`vercel.json` usa `git.deploymentEnabled=false`. O objetivo é deixar o CI validar
cada alteração sem solicitar uma publicação Vercel para todo push. A conexão
Git permanece; o workflow manual de produção continua sendo o caminho de
release revisado e não é executado por esta mudança.

A [documentação oficial de Git Configuration](https://vercel.com/docs/project-configuration/git-configuration)
define false como desativação das publicações automáticas para todas as branches.
Isso não equivale a recuperar cota já consumida nem a fazer upgrade. Branches
antigas precisam incorporar esta configuração para seguir a mesma política;
não reescrever ou descartar trabalho delas para isso.

O preview staging ainda precisa de sincronização GitHub→Vercel e credencial
operacional própria do Environment staging. O token de production não deve ser
revelado/copiado por logs ou artefatos. A nova UI de participação tem gate próprio
de build/servidor na branch experimental; habilitar UI não publica nem ativa API.

Não houve deploy, promoção, alteração de domínio, criação de credencial ou
migração de produção nesta entrega. O efeito na operação manual deverá ser
confirmado na próxima publicação deliberada, quando a cota permitir.
