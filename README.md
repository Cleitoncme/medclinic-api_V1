# MedClinic API

API de clínica médica em NestJS e TypeScript, com autenticação, pacientes, médicos, escalas, agendamentos e prontuários. O projeto é uma implementação própria baseada no documento de requisitos e usa o [repositório do professor](https://github.com/marcomoura-senai/nestjs-clinica) como referência de estudo.

- [Board do projeto](https://github.com/users/Cleitoncme/projects/2)
- [API no Cloud Run](https://medclinic-api-v1-977210567831.southamerica-east1.run.app/api/v1/health): serviço inicial publicado; a versão completa em `develop` depende do merge final e da validação do deploy automático.
- [Publicação e infraestrutura](PUBLICACAO_CLOUD_RUN.md) · [Arquitetura testável](ARQUITETURA_TESTAVEL.md) · [Migração para NestJS](MIGRACAO_NESTJS.md)

## Tecnologias e arquitetura

Node.js 22.12+ da série 22, NestJS, TypeScript, PostgreSQL, TypeORM, JWT, bcrypt, Vitest, Docker e GitHub Actions. Controllers recebem HTTP; services e arquivos de regras concentram validações e regras de negócio; portas descrevem dependências; repositories implementam persistência com TypeORM. O filtro central traduz erros ao envelope HTTP. A aplicação usa migrations, sem `synchronize`.

O modelo contém usuários com UUID e perfis, pacientes com CPF único e exclusão lógica, médicos vinculados a usuários e escalas em JSONB, agendamentos com início/fim em `timestamptz` e registros de prontuário associados a paciente e médico autor. E-mail, CPF e CRM têm unicidade no banco. O cadastro do médico e seu usuário é transacional. A criação de agendamentos bloqueia médico e paciente para impedir conflitos sob concorrência; consultas canceladas liberam o horário.

### Estrutura de pastas

```text
src/
├── controllers/    # rotas e adaptação HTTP
├── services/       # casos de uso e regras de negócio
├── rules/          # regras compartilhadas pelos services
├── domain/         # modelos e erros do domínio
├── ports/          # contratos de persistência e serviços externos
├── repositories/   # implementação das portas com TypeORM
├── entities/       # mapeamento das tabelas
├── database/       # configuração, migrations e seed
├── adapters/       # implementações de senha e token
├── modules/        # composição de dependências no NestJS
├── guards/         # autenticação e autorização
├── decorators/     # metadados de perfis
├── filters/        # tradução centralizada de erros para HTTP
├── dtos/           # tipos de dados de entrada e saída
└── config/         # variáveis de ambiente
tests/              # testes unitários e de regressão
scripts/            # validações auxiliares, incluindo smoke com Docker
.github/workflows/  # validação de PR e publicação
```

O vínculo entre médico e usuário permite autenticação e cadastro atômico; a escala em JSONB representa os turnos completos do médico. Consultas guardam instantes com fuso, preservando o horário mesmo quando a escala muda. A exclusão lógica de pacientes preserva referências históricas, enquanto restrições de unicidade no banco protegem CPF, CRM e e-mail também sob concorrência.

### Convenções de nomes

Pastas usam nomes minúsculos; arquivos compostos usam `kebab-case` e sufixos como `.controller.ts`, `.service.ts`, `.repository.ts`, `.entity.ts`, `.module.ts`, `.port.ts` e `.rules.ts`. As migrations usam nomes descritivos em `kebab-case`. Classes e tipos usam `PascalCase`; variáveis, funções e campos usam `camelCase`; constantes de configuração e tokens usam `UPPER_SNAKE_CASE`. As rotas usam nomes em inglês sob `/api/v1`, conforme o contrato, e as propriedades da API seguem seus nomes exatos.

## Execução local

```sh
git clone https://github.com/Cleitoncme/medclinic-api_V1.git
cd medclinic-api_V1
```

Enquanto a entrega final não estiver incorporada à `main`, use `git checkout develop` após clonar para acessar a versão em desenvolvimento.

1. Instale Node.js compatível e Docker Desktop. Copie `.env.example` para `.env` e preencha as variáveis, incluindo um `JWT_SECRET` próprio e os dados do administrador. Não versione o `.env`.
2. Inicie o PostgreSQL: `docker compose up -d postgres`. O arquivo Compose inicia apenas o banco, não a API. Com `DATABASE_PORT=5434` no `.env`, acesse o banco local nessa porta. Ajuste se ela já estiver ocupada.
3. Na raiz do projeto, execute:

```sh
npm ci
npm run migration:run
npm run seed:admin
npm run start:dev
```

O seed usa `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`; é idempotente e não troca uma senha já existente nem promove usuário sem perfil admin. A API local usa `PORT` (padrão 3000) e responde em `/api/v1/health`. Para compilar e executar sem modo watch: `npm run build` e `npm start`.

### Variáveis

| Variável                                                                                | Uso                                                                                             |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `PORT`                                                                                  | Porta HTTP; o Cloud Run fornece seu valor.                                                      |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Conexão PostgreSQL.                                                                             |
| `DATABASE_SSL`, `DATABASE_SSL_CA`                                                       | TLS para TCP; CA opcional. No socket Unix do proxy Cloud SQL, seguir a configuração do serviço. |
| `JWT_SECRET`, `JWT_EXPIRES_IN`                                                          | Assinatura e duração do token; duração padrão `1h`.                                             |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                           | Credenciais do seed administrativo.                                                             |
| `SEED_ADMIN_ON_START`                                                                   | Se `true`, habilita seed no entrypoint do container; padrão `false`.                            |

Use `.env.example` como referência. Em produção, configure segredos no ambiente/Secret Manager; não os inclua no código ou na imagem.

## Rotas

Todas usam prefixo `/api/v1`; exceto health e login, exigem `Authorization: Bearer <accessToken>`.

| Método | Rota                                                  | Acesso                                                   |
| ------ | ----------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/health`                                             | Público                                                  |
| POST   | `/auth/login`                                         | Público; recebe email e password, retorna accessToken    |
| GET    | `/users/me`                                           | Autenticado                                              |
| POST   | `/users`                                              | admin                                                    |
| POST   | `/patients`                                           | admin, secretary                                         |
| GET    | `/patients`, `/patients/:id`                          | Autenticado                                              |
| PATCH  | `/patients/:id`                                       | admin, secretary                                         |
| DELETE | `/patients/:id`                                       | admin                                                    |
| POST   | `/doctors`                                            | admin                                                    |
| GET    | `/doctors`, `/doctors/:id`                            | Autenticado                                              |
| GET    | `/doctors/:id/work-schedule`                          | Autenticado                                              |
| PUT    | `/doctors/:id/work-schedule`                          | admin                                                    |
| GET    | `/doctors/:id/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | Autenticado                                              |
| POST   | `/appointments`                                       | admin, secretary                                         |
| GET    | `/appointments`, `/appointments/:id`                  | Autenticado; doctor sem admin acessa somente os próprios |
| PATCH  | `/appointments/:id/status`                            | Conforme transição e perfil                              |
| POST   | `/patients/:id/medical-records`                       | doctor com vínculo                                       |
| GET    | `/patients/:id/medical-records`                       | admin ou doctor com vínculo                              |

Listagens usam `data` e `meta`, com `page` padrão 1 e `pageSize` padrão 20 (máximo 100). Pacientes e médicos aceitam filtro parcial `name`; consultas aceitam `doctorId`, `patientId`, `status`, `from` e `to`. Instantes são devolvidos em UTC; datas de filtro consideram dias locais em `America/Sao_Paulo`. A agenda aceita até 31 dias inclusive e não retorna consultas canceladas nem gera slots.

Consulta: `scheduled → in_progress → done`, ou cancelamento permitido conforme o perfil. Para prontuário, vínculo exige consulta `in_progress` ou `done`; a autoria vem do token. Usuário com doctor e admin escreve somente se for médico vinculado; admin pode ler para auditoria.

Erros seguem `{ statusCode, error, message }`. Exemplos: `DADOS_INVALIDOS` (400), `NAO_AUTENTICADO` (401), `ACESSO_NEGADO` (403), conflitos (409) e `TRANSICAO_INVALIDA` (422). Para falhas inesperadas usa-se provisoriamente `ERRO_INTERNO` (500), pois o documento exige envelope de erro 500 mas não especifica um código para ele.

## Testes e qualidade

```sh
npm run test:cov
npm run test:typecheck
npm run test:regression
npm run lint
npm run format:check
docker build -t medclinic-api-v1:pr .
node scripts/smoke-docker.cjs medclinic-api-v1:pr
```

Os unitários usam dublês, sem rede ou banco. O Vitest inclui `tests/unit/**/*.test.ts` e calcula cobertura sobre `src/**/*.service.ts`, `src/**/*.usecase.ts` e `src/**/*.rules.ts`, pois concentram as regras de negócio. Controllers, entidades, adapters, migrations e testes não entram no recorte. O limite é 80% em statements, branches, functions e lines; o relatório HTML fica em `coverage/index.html`. Na verificação local de 28/10/2026, passaram 330 testes unitários e 17 de regressão; a cobertura foi 99,36% de instruções, 99,39% de ramificações e 100% de funções e linhas. O smoke cria PostgreSQL descartável e duas réplicas, testa migrations, permissões e concorrência e remove apenas seus próprios recursos.

## Fluxo e publicação

Branches de trabalho partem de `develop`; PRs são validados para `develop` e `main`. Depois da revisão final, um PR de `develop` para `main` dispara o workflow de publicação em push. O deploy autentica com a chave JSON da conta de serviço no secret `GCP_SERVICE_ACCOUNT_KEY` do GitHub Actions; a execução automática na `main` e a API completa publicada ainda precisam ser verificadas. A chave é uma credencial de longa duração e não deve ser versionada. O ambiente Cloud SQL de teste tem prazo limitado; confira sua disponibilidade antes da avaliação. O projeto não pressupõe contratação de recursos pagos.

No board, Done indica mudança testada e integrada à `develop`; os cards de documentação e validação de publicação permanecem abertos até a conclusão dessas tarefas. A aceitação dos PRs para `develop` foi confirmada pelo aluno com o professor.
