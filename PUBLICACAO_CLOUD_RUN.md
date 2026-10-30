# Docker e publicação no Google Cloud Run

## Estado desta entrega

O código prepara Docker, PostgreSQL com SSL e o workflow de publicação. A nuvem
ainda não foi provisionada: faltam projeto GCP, banco gerenciado, configuração
do serviço, permissões, secret do GitHub e evidência de deploy com URL pública.
O usuário autorizou apenas recursos gratuitos. Não criar recursos pagos nem
ativar faturamento pago como parte desta entrega.

Cloud Run possui franquia gratuita, mas não oferece um teto automático de R$ 0.
Excesso de consumo, armazenamento de imagens e tráfego podem gerar cobrança em
uma conta paga. Alertas de orçamento não interrompem cobrança. Confirmar a
modalidade da conta e as cotas antes do primeiro provisionamento. Créditos de
avaliação são temporários e não equivalem a gratuidade permanente.

Um PostgreSQL externo em plano gratuito, como Neon Free, é uma possibilidade
para avaliar sem criar Cloud SQL. A escolha ainda depende de confirmação.
Para esta inicialização com advisory lock, usar endpoint de conexão direta do
PostgreSQL, sem pool em modo transaction. Conferir limites e disponibilidade
durante a correção; serviços gratuitos podem suspender por inatividade/cota.

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
Este script é um teste de container opcional, separado dos unitários sem rede.

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
  e banco local sem TLS. Valores diferentes de true/false são rejeitados.
- DATABASE_SSL_CA: opcional, certificado PEM da autoridade do provedor. Aceita
  novas linhas reais ou escapadas. A verificação do certificado permanece ativa.
- JWT_SECRET e JWT_EXPIRES_IN: configurados no ambiente do Cloud Run.
- SEED_ADMIN_ON_START: false por padrão. Se true, exige ADMIN_NAME, ADMIN_EMAIL
  e ADMIN_PASSWORD. O seed não troca senha existente nem promove conta sem admin.
- PORT: fornecido pelo Cloud Run. A aplicação escuta em 0.0.0.0.

Aplicar as configurações no painel Cloud Run ou por referências a Secret Manager.
Não colocar JWT_SECRET, senha de banco ou senha do admin no YAML do workflow.

## Workflow e fluxo de branches

.github/workflows/deploy.yml dispara exclusivamente por push em main. O merge
final develop → main gera esse push. Não há deploy de produção por PR nem por
push em develop. O workflow constrói a imagem, autentica via GCP_CREDENTIALS,
publica no Artifact Registry com tag do commit, atualiza o serviço existente
usando deploy-cloudrun e verifica /api/v1/health.

O workflow exige variables preenchidas e serviço previamente configurado. Não
substitui as variáveis/secrets da aplicação: usa estratégia merge e atualiza a
imagem. A primeira infraestrutura deve ser verificada de forma controlada antes
do merge final. Após publicação, conferir que o serviço recebe a imagem esperada.

O check validacao de PRs para develop/main passa a construir a imagem Docker,
além de compilar, executar regressão, tipos, cobertura, lint e formatação.

## Referências

- [Docker multi-stage](https://docs.docker.com/build/building/multi-stage/)
- [Google deploy-cloudrun](https://github.com/google-github-actions/deploy-cloudrun)
- [Google auth](https://github.com/google-github-actions/auth)
- [Cloud Run: preços e franquias](https://cloud.google.com/run/pricing)
- [Programa gratuito GCP](https://cloud.google.com/free/docs/free-cloud-features)
- [Neon: plano gratuito](https://neon.com/pricing)
- [PostgreSQL SSL no driver](https://node-postgres.com/features/ssl)
