const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
Object.assign(process.env, {
  DATABASE_HOST: 'unused',
  DATABASE_NAME: 'unused',
  DATABASE_USER: 'unused',
  DATABASE_PASSWORD: 'unused',
  DATABASE_SSL: 'false',
  JWT_SECRET: 'patients-test-only',
});
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory, APP_FILTER } = require('@nestjs/core');
const jwt = require('jsonwebtoken');
const { QueryFailedError } = require('typeorm');
const { PatientController } = require('../dist/controllers/patient.controller');
const { PatientService } = require('../dist/services/patient.service');
const { AuthenticationGuard } = require('../dist/guards/authentication.guard');
const { RolesGuard } = require('../dist/guards/roles.guard');
const { AppExceptionFilter } = require('../dist/filters/app-exception.filter');
const rows = [];
const repository = {
  async create(input) {
    if (input.cpf === '99999999999')
      throw new QueryFailedError('insert', [], { code: '23505', constraint: 'UQ_patients_cpf' });
    const row = {
      ...input,
      id: rows.length + 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    rows.push(row);
    return row;
  },
  async findByCpf(cpf) {
    return rows.find((p) => p.cpf === cpf) ?? null;
  },
  async findById(id) {
    return rows.find((p) => p.id === id && !p.deletedAt) ?? null;
  },
  async list({ page, pageSize, name }) {
    const data = rows.filter(
      (p) => !p.deletedAt && (!name || p.name.toLowerCase().includes(name.toLowerCase())),
    );
    return { data: data.slice((page - 1) * pageSize, page * pageSize), total: data.length };
  },
  async updateName(id, name) {
    const row = await this.findById(id);
    if (row) row.name = name;
    return row;
  },
  async remove(id) {
    const row = await this.findById(id);
    if (!row) return false;
    row.deletedAt = new Date();
    return true;
  },
};
class PatientHttpModule {}
Module({
  controllers: [PatientController],
  providers: [
    AuthenticationGuard,
    RolesGuard,
    { provide: PatientService, useValue: new PatientService(repository) },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})(PatientHttpModule);
let app;
let url;
before(async () => {
  app = await NestFactory.create(PatientHttpModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});
after(async () => {
  if (app) await app.close();
});
const token = (roles) =>
  jwt.sign({ id: 'test-user', roles }, process.env.JWT_SECRET, { expiresIn: '1h' });
const call = (method, path, body, roles = ['admin']) =>
  fetch(url + '/api/v1/patients' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(roles ? { authorization: 'Bearer ' + token(roles) } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function error(response, status, code) {
  assert.equal(response.status, status);
  const data = await response.json();
  assert.equal(data.statusCode, status);
  assert.equal(data.error, code);
}
test('all routes require authentication; doctor cannot create/update/delete and secretary cannot delete', async () => {
  for (const [method, path, body] of [
    ['POST', '', { name: 'Carlos', cpf: '00123456789' }],
    ['GET', '', undefined],
    ['GET', '/1', undefined],
    ['PATCH', '/1', { name: 'Novo' }],
    ['DELETE', '/1', undefined],
  ])
    await error(await call(method, path, body, null), 401, 'NAO_AUTENTICADO');
  await error(
    await call('POST', '', { name: 'Carlos', cpf: '00123456789' }, ['doctor']),
    403,
    'ACESSO_NEGADO',
  );
  await error(await call('PATCH', '/1', { name: 'Novo' }, ['doctor']), 403, 'ACESSO_NEGADO');
  await error(await call('DELETE', '/1', undefined, ['secretary']), 403, 'ACESSO_NEGADO');
});
test('secretary creates, any profile reads and name update preserves CPF', async () => {
  const created = await call('POST', '', { name: ' Carlos ', cpf: '00123456789' }, ['secretary']);
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    id: 1,
    name: 'Carlos',
    cpf: '00123456789',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  for (const roles of [['doctor'], ['secretary'], ['doctor', 'admin']]) {
    const res = await call('GET', '/1', undefined, roles);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).cpf, '00123456789');
  }
  const update = await call('PATCH', '/1', { name: 'Renomeado' }, ['secretary']);
  assert.equal(update.status, 200);
  const body = await update.json();
  assert.equal(body.name, 'Renomeado');
  assert.equal(body.cpf, '00123456789');
  const list = await call('GET', '?name=NOME&page=1&pageSize=1', undefined, ['doctor']);
  assert.equal(list.status, 200);
  const result = await list.json();
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.meta, { total: 1, page: 1, pageSize: 1, totalPages: 1 });
});
test('CPF conflicts and invalid inputs use the contract envelope', async () => {
  await error(
    await call('POST', '', { name: 'Outro', cpf: '00123456789' }),
    409,
    'CPF_JA_CADASTRADO',
  );
  await error(
    await call('POST', '', { name: 'Race', cpf: '99999999999' }),
    409,
    'CPF_JA_CADASTRADO',
  );
  for (const body of [
    {},
    null,
    [],
    { name: '', cpf: '12345678901' },
    { name: 'Carlos', cpf: 12345678901 },
  ])
    await error(await call('POST', '', body), 400, 'DADOS_INVALIDOS');
  await error(await call('PATCH', '/1', { cpf: '12345678901' }), 400, 'DADOS_INVALIDOS');
  for (const path of ['/abc', '/0', '?page=0', '?pageSize=101', '?name=a&name=b'])
    await error(await call('GET', path), 400, 'DADOS_INVALIDOS');
});
test('admin removes with 204 and removed patient vanishes while CPF stays reserved', async () => {
  const res = await call('DELETE', '/1');
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  await error(await call('GET', '/1'), 404, 'RECURSO_NAO_ENCONTRADO');
  await error(await call('PATCH', '/1', { name: 'Outro' }), 404, 'RECURSO_NAO_ENCONTRADO');
  await error(await call('DELETE', '/1'), 404, 'RECURSO_NAO_ENCONTRADO');
  const list = await call('GET', '');
  assert.deepEqual(await list.json(), {
    data: [],
    meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
  });
  await error(
    await call('POST', '', { name: 'Outro', cpf: '00123456789' }),
    409,
    'CPF_JA_CADASTRADO',
  );
});
