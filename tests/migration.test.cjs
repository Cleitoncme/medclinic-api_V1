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
const { hashPassword } = require('../dist/utils/password');

let app;
let baseUrl;
const users = [];
const repository = {
  create: (data) => ({ ...data }),
  async save(data) {
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
    role: 'ADMIN',
    passwordHash: await hashPassword('test-password'),
  });
  appDataSource.initialize = async () => ({
    isInitialized: false,
    getRepository: () => repository,
  });
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
});

const token = (role, options = {}) =>
  jwt.sign({ id: '1', role }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });
const get = (path, authorization) =>
  fetch(baseUrl + path, { headers: authorization ? { authorization } : {} });
const post = (path, body) =>
  fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('health stays public', async () => {
  const response = await get('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('registration hashes the password, preserves the legacy DTO and rejects duplicates', async () => {
  const input = { name: 'Attendant', email: 'attendant@example.test', password: 'test-password' };
  const response = await post('/auth/register', input);
  assert.equal(response.status, 201);
  const { user } = await response.json();
  assert.equal(user.role, 'ATTENDANT');
  assert.equal(user.passwordHash, undefined);
  assert.notEqual(users.find((item) => item.email === input.email).passwordHash, input.password);
  assert.equal((await post('/auth/register', input)).status, 409);
});

test('login uses the hash and returns a verifiable token', async () => {
  const response = await post('/auth/login', {
    email: 'admin@example.test',
    password: 'test-password',
  });
  assert.equal(response.status, 200);
  const { token: value } = await response.json();
  assert.equal(jwt.verify(value, process.env.JWT_SECRET).role, 'ADMIN');
  assert.equal(
    (await post('/auth/login', { email: 'admin@example.test', password: 'wrong' })).status,
    401,
  );
});

test('authenticated identity reaches the me controller without leaking the hash', async () => {
  const response = await get('/users/me', `Bearer ${token('ADMIN')}`);
  assert.equal(response.status, 200);
  const { user } = await response.json();
  assert.equal(user.id, '1');
  assert.equal(user.passwordHash, undefined);
});

test('missing, malformed, expired and invalid-payload tokens return 401', async () => {
  for (const authorization of [
    undefined,
    'Basic abc',
    'Bearer invalid',
    `Bearer ${token('ADMIN', { expiresIn: -1 })}`,
    `Bearer ${token('unknown')}`,
  ]) {
    const response = await get('/users/me', authorization);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).statusCode, 401);
  }
});

test('guards allow admin and deny attendant', async () => {
  assert.equal((await get('/admin/ping', `Bearer ${token('ADMIN')}`)).status, 200);
  assert.equal((await get('/admin/ping', `Bearer ${token('ATTENDANT')}`)).status, 403);
  assert.equal((await get('/admin/ping')).status, 401);
});

test('invalid input and malformed JSON return 400; unknown routes return 404', async () => {
  assert.equal((await post('/auth/register', {})).status, 400);
  assert.equal((await post('/auth/login', {})).status, 400);
  const invalid = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(invalid.status, 400);
  const missing = await get('/unknown');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).stack, undefined);
});
