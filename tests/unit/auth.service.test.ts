import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../src/services/auth.service';
import type { LoginDTO } from '../../src/dtos/auth.dto';
import { UserRole } from '../../src/domain/user';
import { credentials, dependencies } from './helpers';

describe('AuthService', () => {
  let deps: ReturnType<typeof dependencies>;
  let service: AuthService;
  beforeEach(() => {
    deps = dependencies();
    service = new AuthService(deps.repository, deps.passwords, deps.tokens);
  });

  it.each([UserRole.ADMIN, UserRole.ATTENDANT])(
    'autentica %s comparando senha com hash',
    async (role) => {
      const user = { ...credentials(), role };
      deps.repository.findByEmailWithPassword.mockResolvedValue(user);
      deps.passwords.compare.mockResolvedValue(true);
      deps.tokens.sign.mockReturnValue('issued-token');

      await expect(
        service.login({ email: ' ANA@EXAMPLE.TEST ', password: 'plain-password' }),
      ).resolves.toEqual({ token: 'issued-token' });
      expect(deps.repository.findByEmailWithPassword).toHaveBeenCalledExactlyOnceWith(
        'ana@example.test',
      );
      expect(deps.passwords.compare).toHaveBeenCalledExactlyOnceWith(
        'plain-password',
        'stored-hash',
      );
      expect(deps.tokens.sign).toHaveBeenCalledExactlyOnceWith({ id: user.id, role });
    },
  );

  it('rejeita usuário inexistente sem comparar senha nem emitir token', async () => {
    deps.repository.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@example.test', password: 'password' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials.' });
    expect(deps.passwords.compare).not.toHaveBeenCalled();
    expect(deps.tokens.sign).not.toHaveBeenCalled();
  });

  it('rejeita senha incorreta sem emitir token', async () => {
    deps.repository.findByEmailWithPassword.mockResolvedValue(credentials());
    deps.passwords.compare.mockResolvedValue(false);
    await expect(
      service.login({ email: 'ana@example.test', password: 'incorrect' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials.' });
    expect(deps.passwords.compare).toHaveBeenCalledExactlyOnceWith('incorrect', 'stored-hash');
    expect(deps.tokens.sign).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    [],
    'text',
    1,
    {},
    { email: 1, password: 'password' },
    { email: 'ana@example.test', password: 1 },
    { email: '   ', password: 'password' },
    { email: 'ana@example.test', password: '' },
  ])('rejeita entrada inválida %j antes de consultar o repositório', async (input) => {
    await expect(service.login(input as LoginDTO)).rejects.toMatchObject({ statusCode: 400 });
    expect(deps.repository.findByEmailWithPassword).not.toHaveBeenCalled();
    expect(deps.passwords.compare).not.toHaveBeenCalled();
    expect(deps.tokens.sign).not.toHaveBeenCalled();
  });

  it('propaga falha do repositório sem emitir token', async () => {
    const failure = new Error('repository failure');
    deps.repository.findByEmailWithPassword.mockRejectedValue(failure);
    await expect(service.login({ email: 'ana@example.test', password: 'password' })).rejects.toBe(
      failure,
    );
    expect(deps.tokens.sign).not.toHaveBeenCalled();
  });
});
