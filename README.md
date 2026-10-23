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

## Autenticação no contrato final

GET `/api/v1/health` é público. POST `/api/v1/auth/login` recebe email/password
e devolve `{ accessToken }`. GET `/api/v1/users/me` devolve id/name/email/roles
diretamente. POST `/api/v1/users` exige Bearer de admin e recebe name/email/password/roles.
Perfis válidos: admin, secretary, doctor, em array não vazio; múltiplos perfis são
aceitos. O cadastro público foi removido. Nunca são devolvidos senha ou hash.

Execute `npm run migration:run` antes de iniciar a API e depois `npm run seed:admin`,
com ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD no ambiente. O seed é idempotente
para admin existente e falha para e-mail de não administrador, sem elevar privilégios.
A senha existente não é substituída. Use senha com pelo menos oito caracteres.

A migration incremental converte ADMIN para admin e ATTENDANT para secretary,
preserva UUIDs e credenciais e troca role por roles (enum array PostgreSQL).
UUIDs existentes foram mantidos: o documento mostra IDs numéricos nos exemplos,
mas não impõe conversão. Tokens antigos devem ser descartados após a atualização.
O rollback recusa dados com doctor ou múltiplos perfis para evitar perda silenciosa.
Arquivos de migration têm nomes descritivos, mantendo timestamp no identificador interno.

O envelope de erro é `{ statusCode, error, message }`, com mensagem em português.
DomainError não contém status HTTP; o filtro central faz a tradução, inclusive
violação concorrente da constraint UQ_users_email para EMAIL_JA_CADASTRADO.
Decisão provisória: falhas inesperadas usam 500/ERRO_INTERNO, pois o documento
exige envelope 500 e não lista código correspondente. Detalhes internos não são expostos.

JWT_EXPIRES_IN aceita duração positiva com unidade s/m/h/d, padrão 1h.
No Docker local criado para este projeto, o PostgreSQL usa localhost:5434;
configure as demais variáveis conforme .env.example. Segredos reais não são versionados.
Os helpers parsePagination/paginated preparam o contrato de listagem dos próximos módulos.

## Docker e publicação no Cloud Run

Consulte [PUBLICACAO_CLOUD_RUN.md](PUBLICACAO_CLOUD_RUN.md) para build, teste local,
SSL, migrations/seed na inicialização, configuração do GitHub e infraestrutura pendente.
O workflow publica apenas por push em main. A nuvem ainda não foi provisionada: o
usuário definiu orçamento zero e a configuração externa precisa respeitar esse limite.

## Pacientes

Rotas sob /api/v1, todas com Authorization Bearer:

| Método | Rota          | Perfis               | Resultado                   |
| ------ | ------------- | -------------------- | --------------------------- |
| POST   | /patients     | admin, secretary     | 201 com paciente            |
| GET    | /patients     | qualquer autenticado | 200 com data/meta           |
| GET    | /patients/:id | qualquer autenticado | 200 com paciente            |
| PATCH  | /patients/:id | admin, secretary     | 200 com paciente atualizado |
| DELETE | /patients/:id | admin                | 204 sem corpo               |

O cadastro recebe name e cpf. CPF é string de exatamente 11 dígitos, sem
pontuação; zeros iniciais são preservados. Não se exige cálculo de dígito
verificador. Nome é obrigatório, aparado nas extremidades e limitado a 120
caracteres. As respostas contêm id numérico positivo, name, cpf e createdAt UTC.
O PATCH aceita somente name; tentativa de alterar CPF é recusada com 400.

A listagem aceita page (padrão 1), pageSize (padrão 20, máximo 100) e name
(substring sem diferenciar maiúsculas). A ordenação por id crescente é estável.
Os caracteres %, _ e barra invertida no filtro são tratados literalmente;
consulta parametrizada evita interpretar o nome como SQL. Entradas inválidas
retornam 400 DADOS_INVALIDOS; inexistentes retornam 404 RECURSO_NAO_ENCONTRADO.

A exclusão é lógica: deletedAt permanece no banco, sem aparecer nas respostas.
Removidos não aparecem na listagem, consulta nem alteração; remover novamente
retorna 404. O CPF continua reservado, inclusive após exclusão, para preservar
a unicidade global de RN02 e o histórico usado pelos módulos clínicos futuros.
UQ_patients_cpf impede duplicação inclusive em requisições concorrentes; o
filtro central traduz a violação em 409 CPF_JA_CADASTRADO.

Execute npm run migration:run antes de iniciar a API fora do container.
No Docker, o entrypoint aplica a migration incremental create-patients-table
automaticamente. Não há synchronize. IDs numéricos são usados em pacientes,
seguindo os exemplos do contrato; UUIDs existentes de usuários são preservados.

Os testes unitários usam dublês tipados de PatientRepositoryPort, sem banco,
rede ou ambiente. A regressão HTTP cobre permissões, status e envelopes. O
script opcional scripts/smoke-docker.cjs valida em PostgreSQL temporário o CRUD,
filtros, paginação, remoção lógica e CPF simultâneo em duas réplicas (201/409).
A publicação na nuvem continua acompanhada pelo card #5, independentemente deste módulo.
