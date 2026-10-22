import { vi } from 'vitest';
import { UserRole, type UserCredentials } from '../../src/domain/user';
import type { UserRepositoryPort } from '../../src/ports/user-repository.port';
import type { PasswordPort } from '../../src/ports/password.port';
import type { TokenIssuerPort } from '../../src/ports/token-issuer.port';

export function credentials(): UserCredentials {
  return {
    id: 'user-1',
    name: 'Ana',
    email: 'ana@example.test',
    passwordHash: 'stored-hash',
    role: UserRole.ATTENDANT,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

export function dependencies() {
  return {
    repository: {
      create: vi.fn<UserRepositoryPort['create']>(),
      findByEmail: vi.fn<UserRepositoryPort['findByEmail']>(),
      findByEmailWithPassword: vi.fn<UserRepositoryPort['findByEmailWithPassword']>(),
      findById: vi.fn<UserRepositoryPort['findById']>(),
    } satisfies UserRepositoryPort,
    passwords: {
      hash: vi.fn<PasswordPort['hash']>(),
      compare: vi.fn<PasswordPort['compare']>(),
    } satisfies PasswordPort,
    tokens: { sign: vi.fn<TokenIssuerPort['sign']>() } satisfies TokenIssuerPort,
  };
}
