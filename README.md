# medclinic-api_V1

Base de autenticaÃ§Ã£o migrada para NestJS e TypeScript. Consulte [MIGRACAO_NESTJS.md](MIGRACAO_NESTJS.md) para arquitetura, comandos e limites desta etapa.

## Fluxo de desenvolvimento

A branch `develop` nasce da `main`. As branches de funcionalidade nascem da
`develop` atualizada e seus pull requests tÃªm `develop` como destino. Na entrega,
um PR de `develop` para `main` reÃºne o trabalho revisado e dispara a publicaÃ§Ã£o
quando o workflow de deploy estiver configurado. A branch padrÃ£o continua `main`.

No board, **Done** significa funcionalidade revisada, testada e integrada Ã 
`develop`; o card final acompanha a publicaÃ§Ã£o em produÃ§Ã£o. PRs para `develop`
referenciam a issue explicitamente, pois `Closes #N` sÃ³ encerra automaticamente
issues em PRs destinados Ã  branch padrÃ£o. Vincular o PR e mover o card apÃ³s merge.

O workflow de PR valida `develop` e `main` com o check estÃ¡vel `validacao`, Node 22,
instalaÃ§Ã£o pelo lockfile, compilaÃ§Ã£o, testes de regressÃ£o, lint e formataÃ§Ã£o.
Os testes unitÃ¡rios com cobertura mÃ­nima de 80% nas quatro mÃ©tricas ainda serÃ£o
implementados na issue #2; o check atual nÃ£o comprova essa cobertura.

Board pÃºblico: https://github.com/users/Cleitoncme/projects/2.
