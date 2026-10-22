# Arquitetura testável — etapa 1

Os services recebem suas dependências pelo construtor e não importam TypeORM,
entidades decoradas, bcrypt, jsonwebtoken ou configuração de ambiente.

## Contratos

- `UserRepositoryPort`: criar e consultar usuários; tipos de entrada e retorno
  são modelos do domínio, sem `DeepPartial`, `Repository` ou `EntityManager`.
- `PasswordPort`: gerar hash e comparar a senha recebida com o hash armazenado.
- `TokenIssuerPort`: emitir um token para a identidade autenticada.

O modelo `domain/user.ts` define os dados públicos, credenciais, entrada de
persistência e o enum de perfil. A entidade de banco usa esse enum e o reexporta
para manter compatibilidade com os consumidores existentes. Nada muda no schema
ou nas migrations nesta entrega.

## Composição no NestJS

`UserModule` registra o adapter TypeORM sob o token `USER_REPOSITORY`.
`SecurityModule` registra `BcryptPasswordAdapter` e `JwtTokenAdapter` sob
`PASSWORD_SERVICE` e `TOKEN_ISSUER`.

As factories dos módulos recebem as portas e montam os services. A configuração
JWT é lida na composição e passada ao adapter; o service não importa `env`.
O adapter bcrypt mantém o comportamento existente, incluindo 12 rounds.
Os guards HTTP e a inicialização do banco continuam na borda da aplicação e
usam configuração real ao executar a API.

## Verificação de isolamento

`npm run test:regression` compila e executa os testes de regressão HTTP e a verificação de
isolamento em `tests/services-isolation.test.cjs`. Esta última instancia services
com dublês de repositório, senhas e token, sem definir variáveis ambientais, abrir
conexão de banco, carregar adapters criptográficos ou iniciar um servidor HTTP.

Os dublês de senha/token não são mecanismos de segurança: só existem nos testes.
Os testes de regressão continuam exercitando bcrypt e JWT reais por seus adapters.

A etapa 2 adiciona Vitest e cobertura V8: npm test executa os unitários e
npm run test:cov exige 80% nas quatro métricas sobre os sufixos de regra de negócio.
O recorte e os comandos estão declarados no README. Os testes unitários usam
dublês tipados e não dependem de variáveis de ambiente, rede ou banco.
O tratamento atual por AppError e o contrato HTTP são preservados; a tradução
de erros de domínio e a adequação para /api/v1 seguem no planejamento.
