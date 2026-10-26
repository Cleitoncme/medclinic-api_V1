# Docker e publicação no Google Cloud Run

## Estado desta entrega

Docker e workflow estão preparados. O projeto medclinic-api-v1, o banco medclinic na instância Cloud SQL de teste e o repositório Docker medclinic em southamerica-east1 foram configurados. As identidades de execução/publicação e a federação OIDC estão configuradas. Ainda faltam imagem publicada, serviço Cloud Run, segredos de execução e evidência de deploy com URL pública.
O usuário autorizou apenas recursos gratuitos. Não criar recursos pagos nem
ativar faturamento pago como parte desta entrega.

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

## Configuração externa pendente

1. Entrar no console GCP e conferir elegibilidade a teste gratuito e condições
   de faturamento. A publicação permanece pendente enquanto R$ 0 não puder ser
   respeitado nas condições aceitas pelo usuário.
2. Definir o ID do projeto, região e banco gerenciado com SSL. Configuração
   sugerida para avaliação: Cloud Run com cobrança por requisição, mínimo de
   instâncias zero, máximo um, uma vCPU e 512 MiB. Isso reduz consumo; não é um
   limite financeiro. Não provisionar Cloud SQL automaticamente.
3. Habilitar APIs do Cloud Run e Artifact Registry. Criar repositório Docker no
   Artifact Registry e planejar retenção das imagens dentro da cota gratuita.
4. Criar uma conta de serviço de execução e outra para o deploy. A identidade
   de deploy precisa atualizar o serviço (Cloud Run Developer), publicar no
   repositório (Artifact Registry Writer, limitado ao repositório) e atuar como
   a conta de execução (Service Account User, limitada à conta). Não usar Owner.
5. A criação de chaves JSON é bloqueada pela política iam.disableServiceAccountKeyCreation. O professor aceitou a substituição por OIDC, conforme confirmado pelo aluno. Não alterar a política; GCP_CREDENTIALS não é mais utilizado. O pool medclinic-github e provedor github aceitam apenas IDs 1427700678/81780978, push na main e o workflow deploy.yml. O vínculo Workload Identity User usa o subject exato repo:Cleitoncme/medclinic-api_V1:ref:refs/heads/main na conta medclinic-deploy.
6. As seis **variables** do GitHub estão configuradas: GCP_PROJECT_ID, GCP_REGION, GAR_REPOSITORY, CLOUD_RUN_SERVICE, GCP_WORKLOAD_IDENTITY_PROVIDER e GCP_DEPLOY_SERVICE_ACCOUNT. Os dois últimos valores são projects/977210567831/locations/global/workloadIdentityPools/medclinic-github/providers/github e medclinic-deploy@medclinic-api-v1.iam.gserviceaccount.com. São identificadores, não credenciais.
7. Fazer a primeira publicação controlada do container e configurar as variáveis
   de runtime, SSL e seed antes de iniciar a API. O serviço precisa permitir
   invocação pública para a bateria de avaliação; os endpoints privados continuam
   protegidos pelo JWT da aplicação. Alterações de IAM/exposição exigem confirmação.
   Registrar a URL e validar health/login. Desativar SEED_ADMIN_ON_START após o
   primeiro seed é opcional; a repetição é idempotente.
8. Só considerar a infraestrutura publicada após teste real da URL com banco
   gerenciado. Anexar evidência ao card #5; esta etapa ainda não está concluída.

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
