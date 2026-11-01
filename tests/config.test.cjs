const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

function config(extra = {}) {
  const env = {
    ...process.env,
    DATABASE_HOST: 'unused',
    DATABASE_NAME: 'unused',
    DATABASE_USER: 'unused',
    DATABASE_PASSWORD: 'unused',
    JWT_SECRET: 'test-only',
    JWT_EXPIRES_IN: '1h',
    PORT: '3000',
    DATABASE_PORT: '5432',
  };
  delete env.DATABASE_SSL;
  delete env.DATABASE_SSL_CA;
  return spawnSync(
    process.execPath,
    ['-e', "process.stdout.write(JSON.stringify(require('./dist/config/env').env.database.ssl))"],
    { cwd: process.cwd(), env: { ...env, ...extra }, encoding: 'utf8' },
  );
}
test('SSL is required by default in production with certificate verification', () => {
  const result = config({ NODE_ENV: 'production' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { rejectUnauthorized: true });
});
test('development defaults to no SSL; explicit false supports local Docker', () => {
  assert.equal(JSON.parse(config({ NODE_ENV: 'development' }).stdout), false);
  assert.equal(JSON.parse(config({ NODE_ENV: 'production', DATABASE_SSL: 'false' }).stdout), false);
});
test('configured CA accepts escaped newlines and retains verification', () => {
  const result = config({ DATABASE_SSL: 'true', DATABASE_SSL_CA: 'first\\nsecond' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { rejectUnauthorized: true, ca: 'first\nsecond' });
});
test('unknown SSL configuration is rejected', () => {
  assert.notEqual(config({ DATABASE_SSL: 'maybe' }).status, 0);
});
