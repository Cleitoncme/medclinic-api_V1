# Migração da base para NestJS

Esta entrega substitui o bootstrap Express por NestFactory/AppModule, registra controllers e providers em módulos, recebe dependências nos construtores, usa guards para autenticação/RBAC e um filtro global de exceções. Entidade, migration e dados existentes são preservados.

O código foi desenvolvido a partir da API do aluno. O repositório do professor é referência de conceitos; módulos e soluções não foram transplantados.

## Executar

1. `npm ci` após a atualização do lockfile pela instalação das dependências.
2. Criar `.env` com base no `.env.example` e informar as credenciais locais.
3. `docker compose up -d` e `npm run migration:run`.
4. `npm run build` e `npm start`.
5. Para desenvolvimento, manter `npm run dev` (compilação em watch) em um terminal e `npm run start:dev` em outro (reinício do Node a partir de dist).

A aplicação usa `src/main.ts` e executa `dist/main.js`. Migrations e seed continuam disponíveis pelos mesmos comandos. O provider do banco inicializa a conexão e fecha-a no desligamento da aplicação.

## Escopo desta migração

Mantidos os endpoints `/health`, `/auth/register`, `/auth/login`, `/users/me`, `/admin/ping`, os perfis ADMIN/ATTENDANT e os DTOs da etapa 1. A conversão de framework não equivale à conclusão do contrato final: prefixo /api/v1, accessToken, novos perfis, erros de domínio e módulos clínicos são entregas subsequentes.

`npm test` compila e roda verificações HTTP de regressão com repository/banco substituídos por dublês. Cobre cadastro/login, identidade autenticada, RBAC, tokens inválidos/expirados, JSON malformado e rotas inexistentes. Não exige PostgreSQL real. Estes testes de migração não substituem os unitários e o limiar de cobertura da etapa 2.

## Referências

- Documentação de NestJS: https://docs.nestjs.com/first-steps e https://docs.nestjs.com/guards.
- Referência didática indicada pelo aluno: https://github.com/marcomoura-senai/nestjs-clinica/tree/feat/appointment.

NestJS continua sendo TypeScript. O documento de requisitos lido permite Express ou NestJS; a adoção de NestJS atende à decisão posterior do aluno.

## ValidaÃ§Ã£o em 20/10/2026

CompilaÃ§Ã£o e sete testes de regressÃ£o passaram; ESLint passou. As duas vulnerabilidades transitivas inicialmente apontadas foram corrigidas com npm audit fix sem force; o audit terminou com zero vulnerabilidades. O banco real e o seed nÃ£o foram executados.
