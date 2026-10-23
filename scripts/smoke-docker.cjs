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
      '2',
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
