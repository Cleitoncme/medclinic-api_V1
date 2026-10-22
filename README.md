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
O check inclui os testes unitários e exige 80% nas quatro métricas da camada de negócio.

Board pÃºblico: https://github.com/users/Cleitoncme/projects/2.

## Arquitetura para testes

Consulte [ARQUITETURA_TESTAVEL.md](ARQUITETURA_TESTAVEL.md) para interfaces, adapters e isolamento.

## Testes unitários e cobertura

Use Node.js 22.12 ou superior da série 22 (o CI usa Node 22), ou uma versão
compatível declarada em engines. Instale as dependências com npm ci.

- npm test: executa os unitários com Vitest.
- npm run test:cov: executa os unitários e exige pelo menos 80% em lines,
  branches, functions e statements. Qualquer métrica abaixo disso reprova o comando.
- npm run test:typecheck: verifica a tipagem estrita dos testes e dublês.
- npm run test:regression: compila e executa os testes legados HTTP e de isolamento.

O recorte está em `vitest.config.mts`: `src/**/*.service.ts`,
`src/**/*.usecase.ts` e `src/**/*.rules.ts`. Arquivos novos com esses sufixos entram
na cobertura mesmo sem importação por um teste. Controllers, entidades, módulos,
adapters, repositórios TypeORM e migrations ficam fora da métrica de negócio.
Regras novas devem seguir esses sufixos; ao introduzir outro padrão, atualizar o recorte.

Os unitários ficam em tests/unit e usam dublês tipados sobre as portas de
repositório, senha e token. Não iniciam HTTP, não usam rede ou banco e não precisam
de variáveis de ambiente. A regressão HTTP é separada e não entra na cobertura.

Os relatórios locais ficam em coverage/index.html e coverage/coverage-summary.json.
A suíte atual verifica os serviços de usuários e autenticação: cadastro, normalização,
hash, duplicidade, entrada inválida, consulta e autenticação. Os casos mínimos de
agendamentos, sobreposição, escalas, status e prontuário da seção 4.5 serão escritos
junto dessas funcionalidades. A cobertura atual não comprova regras ainda não implementadas.

Em PRs para develop e main, o job validacao compila, roda a regressão, verifica os
tipos, executa test:cov e confere lint e formatação. O nome do check permanece estável.
