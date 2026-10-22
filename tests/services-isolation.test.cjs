const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UserService } = require('../dist/services/user.service');
const { AuthService } = require('../dist/services/auth.service');
const { UserRole } = require('../dist/domain/user');

function dependencies() {
  const users = [];
  const comparisons = [];
  const signed = [];
  const repository = {
    async create(input) {
      const user = { ...input, id: String(users.length + 1), createdAt: new Date(0) };
      users.push(user);
      return user;
    },
    async findByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async findByEmailWithPassword(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async findById(id) {
      return users.find((user) => user.id === id) ?? null;
    },
  };
  // Deliberately not cryptography: these doubles verify dependency boundaries.
  const passwords = {
    async hash(value) {
      return `double:${value}`;
    },
    async compare(value, digest) {
      comparisons.push({ value, digest });
      return digest === `double:${value}`;
    },
  };
  const tokens = {
    sign(payload) {
      signed.push(payload);
      return 'issued-by-double';
    },
  };
  return { repository, passwords, tokens, users, comparisons, signed };
}

test('services register, authenticate and read a user using only injected doubles', async () => {
  const deps = dependencies();
  const users = new UserService(deps.repository, deps.passwords);
  const auth = new AuthService(deps.repository, deps.passwords, deps.tokens);
  const registered = await users.register({
    name: ' Ana ',
    email: ' ANA@EXAMPLE.TEST ',
    password: 'test-password',
  });

  assert.equal(registered.name, 'Ana');
  assert.equal(registered.email, 'ana@example.test');
  assert.equal(registered.role, UserRole.ATTENDANT);
  assert.equal(registered.passwordHash, undefined);
  assert.equal(deps.users[0].passwordHash, 'double:test-password');
  assert.deepEqual(await auth.login({ email: 'ANA@EXAMPLE.TEST', password: 'test-password' }), {
    token: 'issued-by-double',
  });
  assert.deepEqual(deps.comparisons, [{ value: 'test-password', digest: 'double:test-password' }]);
  assert.deepEqual(deps.signed, [{ id: registered.id, role: UserRole.ATTENDANT }]);
  assert.deepEqual(await users.getById(registered.id), registered);
});

test('authentication refuses missing users or failed comparisons without issuing a token', async () => {
  const deps = dependencies();
  const users = new UserService(deps.repository, deps.passwords);
  const auth = new AuthService(deps.repository, deps.passwords, deps.tokens);
  const rejectsCredentials = { statusCode: 401, message: 'Invalid credentials.' };

  await assert.rejects(
    auth.login({ email: 'missing@example.test', password: 'test-password' }),
    rejectsCredentials,
  );
  assert.equal(deps.comparisons.length, 0);
  await users.register({ name: 'Ana', email: 'ana@example.test', password: 'test-password' });
  await assert.rejects(
    auth.login({ email: 'ana@example.test', password: 'incorrect' }),
    rejectsCredentials,
  );
  assert.equal(deps.signed.length, 0);
});

test('importing and executing the services does not load environment, database or crypto adapters', () => {
  const loaded = Object.keys(require.cache).map((path) => path.replaceAll('\\', '/'));
  assert.equal(
    loaded.some((path) => /\/(typeorm|jsonwebtoken|bcryptjs)\//.test(path)),
    false,
  );
  assert.equal(
    loaded.some((path) => /\/dist\/(config|database|adapters|entities)\//.test(path)),
    false,
  );
});
