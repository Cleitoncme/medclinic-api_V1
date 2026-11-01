const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Configuration and database doubles are confined to this regression harness.
Object.assign(process.env, {
  DATABASE_HOST: 'unused',
  DATABASE_NAME: 'unused',
  DATABASE_USER: 'unused',
  DATABASE_PASSWORD: 'unused',
  JWT_SECRET: 'migration-test-secret-only',
});
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const jwt = require('jsonwebtoken');
const { appDataSource } = require('../dist/database/data-source');
const { AppModule } = require('../dist/app.module');
const { QueryFailedError } = require('typeorm');
const { hashPassword } = require('../dist/utils/password');

let app;
let baseUrl;
const users = [];
const repository = {
  create: (data) => ({ ...data }),
  async save(data) {
    if (data.email === 'race@example.test')
      throw new QueryFailedError('insert', [], { code: '23505', constraint: 'UQ_users_email' });
    if (data.email === 'broken@example.test') throw new Error('private database details');
    const saved = { ...data, id: String(users.length + 1), createdAt: new Date() };
    users.push(saved);
    return saved;
  },
  async findOne({ where }) {
    const user = users.find((item) =>
      Object.entries(where).every(([key, value]) => item[key] === value),
    );
    if (!user) return null;
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  },
  createQueryBuilder() {
    let email;
    return {
      addSelect() {
        return this;
      },
      where(_sql, params) {
        email = params.email;
        return this;
      },
      async getOne() {
        return users.find((item) => item.email === email) ?? null;
      },
    };
  },
};

before(async () => {
  await repository.save({
    name: 'Admin',
    email: 'admin@example.test',
    roles: ['admin'],
    passwordHash: await hashPassword('test-password'),
  });
  appDataSource.initialize = async () => ({
    isInitialized: false,
    getRepository: () => repository,
  });
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => {
  if (app) await app.close();
});
const token = (roles = ['admin'], options = {}) =>
  jwt.sign({ id: '1', roles }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
const get = (path, authorization) =>
  fetch(baseUrl + path, { headers: authorization ? { authorization } : {} });
const post = (path, body, authorization) =>
  fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
async function expectError(response, status, error) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.statusCode, status);
  assert.equal(body.error, error);
  assert.equal(typeof body.message, 'string');
  assert.deepEqual(Object.keys(body).sort(), ['error', 'message', 'statusCode']);
  return body;
}
const input = {
  name: 'Secretary',
  email: 'secretary@example.test',
  password: 'test-password',
  roles: ['secretary'],
};
test('health is public under /api/v1; legacy routes are removed', async () => {
  const res = await get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
  await expectError(await get('/health'), 404, 'RECURSO_NAO_ENCONTRADO');
  await expectError(
    await post('/api/v1/auth/register', { ...input, roles: ['admin'] }),
    404,
    'RECURSO_NAO_ENCONTRADO',
  );
});
test('only admin creates users; multiple roles are preserved and no hash leaks', async () => {
  await expectError(await post('/api/v1/users', input), 401, 'NAO_AUTENTICADO');
  for (const roles of [['secretary'], ['doctor']])
    await expectError(
      await post('/api/v1/users', input, 'Bearer ' + token(roles)),
      403,
      'ACESSO_NEGADO',
    );
  const res = await post('/api/v1/users', input, 'Bearer ' + token(['doctor', 'admin']));
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), {
    id: '2',
    name: input.name,
    email: input.email,
    roles: input.roles,
  });
  assert.notEqual(users[1].passwordHash, input.password);
  const multi = await post(
    '/api/v1/users',
    { ...input, email: 'multi@example.test', roles: ['admin', 'doctor'] },
    'Bearer ' + token(),
  );
  assert.equal(multi.status, 201);
  assert.deepEqual((await multi.json()).roles, ['admin', 'doctor']);
  await expectError(
    await post('/api/v1/users', input, 'Bearer ' + token()),
    409,
    'EMAIL_JA_CADASTRADO',
  );
});
test('login returns expiring accessToken with identity and roles; credentials fail identically', async () => {
  const res = await post('/api/v1/auth/login', {
    email: ' ADMIN@EXAMPLE.TEST ',
    password: 'test-password',
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body), ['accessToken']);
  const payload = jwt.verify(body.accessToken, process.env.JWT_SECRET);
  assert.equal(payload.id, '1');
  assert.deepEqual(payload.roles, ['admin']);
  assert.ok(payload.exp > payload.iat);
  const me = await get('/api/v1/users/me', 'Bearer ' + body.accessToken);
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    id: '1',
    name: 'Admin',
    email: 'admin@example.test',
    roles: ['admin'],
  });
  const first = await expectError(
    await post('/api/v1/auth/login', { email: 'missing@example.test', password: 'wrong' }),
    401,
    'CREDENCIAIS_INVALIDAS',
  );
  const second = await expectError(
    await post('/api/v1/auth/login', { email: 'admin@example.test', password: 'wrong' }),
    401,
    'CREDENCIAIS_INVALIDAS',
  );
  assert.deepEqual(first, second);
});
test('missing, expired, wrong-signature and malformed tokens return NAO_AUTENTICADO', async () => {
  for (const auth of [
    undefined,
    'Basic abc',
    'Bearer invalid',
    'Bearer ',
    'Bearer ' + token(['admin'], { expiresIn: -1 }),
    'Bearer ' + token(['unknown']),
    'Bearer ' + token([]),
    'Bearer ' + token('admin'),
    'Bearer ' + jwt.sign({ id: '1', roles: ['admin'] }, 'wrong', { expiresIn: '1h' }),
    'Bearer ' + jwt.sign({ id: '1', roles: ['admin'] }, process.env.JWT_SECRET),
    'Bearer ' + jwt.sign({ id: 1, roles: ['admin'] }, process.env.JWT_SECRET, { expiresIn: '1h' }),
  ]) {
    await expectError(await get('/api/v1/users/me', auth), 401, 'NAO_AUTENTICADO');
  }
});
test('invalid payloads, missing fields and malformed JSON use the error envelope', async () => {
  for (const value of [
    {},
    null,
    [],
    { ...input, roles: [] },
    { ...input, roles: ['unknown'] },
    { ...input, password: 'short' },
  ])
    await expectError(
      await post('/api/v1/users', value, 'Bearer ' + token()),
      400,
      'DADOS_INVALIDOS',
    );
  await expectError(await post('/api/v1/auth/login', {}), 400, 'DADOS_INVALIDOS');
  const bad = await fetch(baseUrl + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  await expectError(bad, 400, 'DADOS_INVALIDOS');
});
test('database uniqueness races are translated; internal details never leak', async () => {
  await expectError(
    await post('/api/v1/users', { ...input, email: 'race@example.test' }, 'Bearer ' + token()),
    409,
    'EMAIL_JA_CADASTRADO',
  );
  const body = await expectError(
    await post('/api/v1/users', { ...input, email: 'broken@example.test' }, 'Bearer ' + token()),
    500,
    'ERRO_INTERNO',
  );
  assert.ok(!body.message.includes('database'));
});
