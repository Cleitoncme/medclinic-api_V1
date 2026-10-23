const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const image = process.argv[2] || 'medclinic-api-v1:publicacao';
const prefix = `medclinic-smoke-${process.pid}-${Date.now()}`;
const network = `${prefix}-network`;
const database = `${prefix}-db`;
const apps = [`${prefix}-api-1`, `${prefix}-api-2`];
const started = [];
let networkCreated = false;
const jwtSecret = randomUUID();
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function waitFor(check, message) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if (await check()) return;
    } catch {
      /* Service is starting. */
    }
    await delay(500);
  }
  throw new Error(message);
}
async function login(url) {
  return fetch(`${url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smoke.test', password: 'test-only-password' }),
    signal: AbortSignal.timeout(5000),
  });
}
async function main() {
  try {
    docker('network', 'create', network);
    networkCreated = true;
    docker(
      'run',
      '--rm',
      '-d',
      '--name',
      database,
      '--network',
      network,
      '--network-alias',
      'smoke-db',
      '-e',
      'POSTGRES_PASSWORD=test-only',
      '-e',
      'POSTGRES_DB=medclinic',
      'postgres:16-alpine',
    );
    started.push(database);
    await waitFor(
      () =>
        docker('exec', database, 'pg_isready', '-U', 'postgres', '-d', 'medclinic').includes(
          'accepting connections',
        ),
      'PostgreSQL não iniciou.',
    );
    // Starting two replicas exercises the migration/seed advisory lock.
    for (const name of apps) {
      docker(
        'run',
        '--rm',
        '-d',
        '--name',
        name,
        '--network',
        network,
        '-p',
        '127.0.0.1::8080',
        '-e',
        'PORT=8080',
        '-e',
        'DATABASE_HOST=smoke-db',
        '-e',
        'DATABASE_PORT=5432',
        '-e',
        'DATABASE_NAME=medclinic',
        '-e',
        'DATABASE_USER=postgres',
        '-e',
        'DATABASE_PASSWORD=test-only',
        '-e',
        'DATABASE_SSL=false',
        '-e',
        `JWT_SECRET=${jwtSecret}`,
        '-e',
        'SEED_ADMIN_ON_START=true',
        '-e',
        'ADMIN_NAME=Smoke Admin',
        '-e',
        'ADMIN_EMAIL=admin@smoke.test',
        '-e',
        'ADMIN_PASSWORD=test-only-password',
        image,
      );
      started.push(name);
    }
    const urls = apps.map((name) => `http://${docker('port', name, '8080/tcp')}`);
    for (const url of urls) {
      await waitFor(
        async () => (await fetch(`${url}/api/v1/health`, { signal: AbortSignal.timeout(2000) })).ok,
        'API não iniciou.',
      );
      const response = await login(url);
      assert.equal(response.status, 200);
      const { accessToken } = await response.json();
      const me = await fetch(`${url}/api/v1/users/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      assert.equal(me.status, 200);
      const body = await me.json();
      assert.deepEqual(body.roles, ['admin']);
      assert.equal(body.passwordHash, undefined);
    }
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM migrations',
      ),
      '3',
    );
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM users',
      ),
      '1',
    );
    docker(
      'exec',
      apps[0],
      'node',
      '-e',
      "const assert=require('node:assert/strict');const fs=require('node:fs');assert.notEqual(process.getuid(),0);for(const x of ['typescript','vitest'])assert.throws(()=>require.resolve(x));for(const x of ['.env','tests','src'])assert.equal(fs.existsSync(x),false);",
    );

    const jwt = require('jsonwebtoken');
    const patientToken = (roles) =>
      jwt.sign({ id: 'smoke-user', roles }, jwtSecret, { expiresIn: '1h' });
    async function patientRequest(method, path = '', body, roles = ['admin'], server = 0) {
      return fetch(urls[server] + '/api/v1/patients' + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(roles ? { authorization: 'Bearer ' + patientToken(roles) } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    const creation = await patientRequest(
      'POST',
      '',
      { name: ' Carlos Silva ', cpf: '00123456789' },
      ['secretary'],
    );
    assert.equal(creation.status, 201);
    const created = await creation.json();
    assert.equal(typeof created.id, 'number');
    assert.equal(created.cpf, '00123456789');
    assert.equal(created.name, 'Carlos Silva');
    assert.ok(created.createdAt.endsWith('Z'));
    assert.equal(
      (await patientRequest('POST', '', { name: 'Blocked', cpf: '11111111111' }, ['doctor']))
        .status,
      403,
    );
    assert.equal((await patientRequest('GET', '', undefined, null)).status, 401);
    assert.equal(
      (await patientRequest('GET', '/' + created.id, undefined, ['doctor'], 1)).status,
      200,
    );
    const found = await patientRequest('GET', '?name=SiLvA&page=1&pageSize=1', undefined, [
      'doctor',
    ]);
    assert.equal(found.status, 200);
    const listing = await found.json();
    assert.equal(listing.data.length, 1);
    assert.deepEqual(listing.meta, { total: 1, page: 1, pageSize: 1, totalPages: 1 });
    const literalName = 'Literal 100%_\\ value';
    assert.equal(
      (await patientRequest('POST', '', { name: literalName, cpf: '11111111111' })).status,
      201,
    );
    const literal = await patientRequest('GET', '?name=' + encodeURIComponent('%_\\'));
    assert.equal((await literal.json()).meta.total, 1);
    const injection = await patientRequest('GET', '?name=' + encodeURIComponent("' OR 1=1 --"));
    assert.equal((await injection.json()).meta.total, 0);
    const parallel = await Promise.all(
      [0, 1].map((server) =>
        patientRequest('POST', '', { name: 'Parallel', cpf: '22222222222' }, ['secretary'], server),
      ),
    );
    assert.deepEqual(parallel.map((r) => r.status).sort(), [201, 409]);
    assert.equal((await parallel.find((r) => r.status === 409).json()).error, 'CPF_JA_CADASTRADO');
    const nextPage = await patientRequest('GET', '?page=2&pageSize=1');
    const nextBody = await nextPage.json();
    assert.equal(nextBody.meta.total, 3);
    assert.equal(nextBody.data.length, 1);
    assert.notEqual(nextBody.data[0].id, created.id);
    const rename = await patientRequest('PATCH', '/' + created.id, { name: 'Atualizado' }, [
      'secretary',
    ]);
    assert.equal(rename.status, 200);
    assert.equal((await rename.json()).cpf, created.cpf);
    assert.equal(
      (await patientRequest('DELETE', '/' + created.id, undefined, ['secretary'])).status,
      403,
    );
    const removal = await patientRequest('DELETE', '/' + created.id);
    assert.equal(removal.status, 204);
    assert.equal(await removal.text(), '');
    assert.equal((await patientRequest('GET', '/' + created.id)).status, 404);
    assert.equal((await patientRequest('PATCH', '/' + created.id, { name: 'Revive' })).status, 404);
    assert.equal((await patientRequest('DELETE', '/' + created.id)).status, 404);
    assert.equal(
      (await patientRequest('POST', '', { name: 'Reserved', cpf: created.cpf })).status,
      409,
    );
    const active = await patientRequest('GET', '');
    assert.equal((await active.json()).meta.total, 2);
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM patients WHERE deleted_at IS NOT NULL',
      ),
      '1',
    );
    console.log(
      'OK: pacientes CRUD, CPF com zeros, filtro literal sem injecao, paginacao, permissoes, soft delete e CPF concorrente 201/409.',
    );

    docker('restart', apps[0]);
    await waitFor(
      async () => (await login(`http://${docker('port', apps[0], '8080/tcp')}`)).ok,
      'Reinício não preservou o administrador.',
    );
    assert.equal(
      docker(
        'exec',
        database,
        'psql',
        '-U',
        'postgres',
        '-d',
        'medclinic',
        '-tAc',
        'SELECT count(*) FROM users',
      ),
      '1',
    );
    console.log(
      'OK: duas réplicas, migrations únicas, seed idempotente, PORT=8080, health/login/me e reinício.',
    );
    console.log('OK: processo sem root; imagem sem .env, fontes, testes, TypeScript ou Vitest.');
  } finally {
    for (const name of started.reverse()) {
      try {
        docker('stop', '--time', '5', name);
      } catch {
        /* Already stopped. */
      }
    }
    if (networkCreated) {
      try {
        docker('network', 'rm', network);
      } catch {
        /* Report failures below. */
      }
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
