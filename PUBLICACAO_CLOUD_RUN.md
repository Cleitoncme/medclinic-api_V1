# Docker e publicação no Google Cloud Run

## Estado desta entrega

A infraestrutura inicial e um serviço Cloud Run foram configurados e publicados manualmente. O health público respondeu na validação inicial. As funcionalidades completas estão em develop e ainda precisam ser publicadas e verificadas pelo workflow após o PR final para main. A execução automática via OIDC permanece pendente de comprovação. A conta de teste e as cotas devem ser conferidas antes da entrega; não foi autorizado upgrade pago.

Cloud Run possui franquia gratuita, mas não oferece um teto automático de R$ 0.
Excesso de consumo, armazenamento de imagens e tráfego podem gerar cobrança em
uma conta paga. Alertas de orçamento não interrompem cobrança. Confirmar a
modalidade da conta e as cotas antes do primeiro provisionamento. Créditos de
avaliação são temporários e não equivalem a gratuidade permanente.

O banco escolhido é a instância de teste Cloud SQL free-trial-first-project (PostgreSQL 18.6). Em 26/10/2026, o Console mostrava 30 dias restantes no teste do banco, separado dos 62 dias/créditos da conta. Ao expirar, a instância deixa de atender sem upgrade. Verificar a disponibilidade durante toda a correção. Não foi autorizado upgrade.

## Validação local

```sh
docker build --tag medclinic-api-v1:publicacao .
node scripts/smoke-docker.cjs
```

O teste cria uma rede, PostgreSQL descartável e duas réplicas da API com nomes
exclusivos. Confere migrations únicas, seed idempotente, PORT=8080, health, login,
identidade e reinício. Também verifica usuário sem root e ausência de .env,
fontes, testes, TypeScript e Vitest na imagem. Encerra apenas os recursos criados
pelo próprio teste. Não usa o banco local do projeto nem credenciais reais.
Este script é separado dos unitários sem rede e também é executado no workflow de validação dos PRs.

O Dockerfile tem etapas de build, dependências de produção e runtime. O contexto
é uma lista de arquivos permitidos em .dockerignore; .env e credenciais geradas
por Actions não entram na imagem. docker-entrypoint.sh mantém LF no checkout.

## Inicialização e banco

O entrypoint executa dist/database/prepare.js e inicia a API somente se o preparo
terminar com sucesso. O preparo usa lock de sessão do PostgreSQL para serializar
migrations e seed entre réplicas. Migrations são transacionais. O lock não resolve
compatibilidade entre versões: mudanças futuras de schema devem permitir que
revisões antigas e novas convivam durante uma troca de tráfego.

- DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD:
  configurados no ambiente do serviço, nunca em argumentos de build.
- DATABASE_SSL: true por padrão em NODE_ENV=production; false apenas para testes
  e banco local sem TLS; ou false para o socket Unix do proxy Cloud SQL gerenciado. O proxy criptografa e autentica a conexão até a instância. Não usar false para TCP direto de produção. Valores diferentes de true/false são rejeitados.
- DATABASE_SSL_CA: opcional, certificado PEM da autoridade do provedor. Aceita
  novas linhas reais ou escapadas. A verificação do certificado permanece ativa.
- JWT_SECRET e JWT_EXPIRES_IN: configurados no ambiente do Cloud Run.
- SEED_ADMIN_ON_START: false por padrão. Se true, exige ADMIN_NAME, ADMIN_EMAIL
  e ADMIN_PASSWORD. O seed não troca senha existente nem promove conta sem admin.
- PORT: fornecido pelo Cloud Run. A aplicação escuta em 0.0.0.0.

Aplicar as configurações no painel Cloud Run ou por referências a Secret Manager.
Não colocar JWT_SECRET, senha de banco ou senha do admin no YAML do workflow.

## Verificações antes da entrega

- Conferir a disponibilidade do Cloud SQL de teste, sua data de expiração e as condições da conta, sem contratar recursos pagos.
- Conferir as variáveis de Actions e as referências aos segredos no serviço sem expor valores. OIDC usa o pool e a conta de publicação configurados para push em main.
- Após o PR final develop → main, acompanhar o workflow de publicação e verificar a revisão e a imagem implantadas.
- Validar health, login, conexão ao banco e contrato público; registrar evidências e atualizar o card #5. O serviço inicial publicado não comprova o deploy automático nem a versão completa.

## Workflow e fluxo de branches

.github/workflows/deploy.yml dispara exclusivamente por push em main. O merge
final develop → main gera esse push. Não há deploy de produção por PR nem por
push em develop. O workflow constrói a imagem, autentica via OIDC com credenciais temporárias,
publica no Artifact Registry com tag do commit, atualiza o serviço existente
usando deploy-cloudrun e verifica /api/v1/health.

O workflow exige variables preenchidas e serviço previamente configurado. Não
substitui as variáveis/secrets da aplicação: usa estratégia merge e atualiza a
imagem. A primeira infraestrutura deve ser verificada de forma controlada antes
do merge final. Após publicação, conferir que o serviço recebe a imagem esperada.

O check validacao de PRs para develop/main passa a construir a imagem Docker,
e testar contrato/atomicidade em PostgreSQL temporário, além de compilar, executar regressão, tipos, cobertura, lint e formatação.

## Referências

- [Docker multi-stage](https://docs.docker.com/build/building/multi-stage/)
- [Google deploy-cloudrun](https://github.com/google-github-actions/deploy-cloudrun)
- [Google auth](https://github.com/google-github-actions/auth)
- [Cloud Run: preços e franquias](https://cloud.google.com/run/pricing)
- [Programa gratuito GCP](https://cloud.google.com/free/docs/free-cloud-features)
- [Neon: plano gratuito](https://neon.com/pricing)
- [PostgreSQL SSL no driver](https://node-postgres.com/features/ssl)
