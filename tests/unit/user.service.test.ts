import { beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../src/services/user.service';
import type { CreateUserDTO } from '../../src/dtos/user.dto';
import { UserRole } from '../../src/domain/user';
import { credentials, dependencies } from './helpers';

describe('UserService', () => {
  let deps: ReturnType<typeof dependencies>;
  let service: UserService;
  const input = { name: ' Ana ', email: ' ANA@EXAMPLE.TEST ', password: 'password' };
  beforeEach(() => {
    deps = dependencies();
    service = new UserService(deps.repository, deps.passwords);
  });

  it('normaliza cadastro, persiste hash e não expõe credenciais', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('stored-hash');
    deps.repository.create.mockResolvedValue(credentials());
    const result = await service.register(input);
    expect(deps.repository.findByEmail).toHaveBeenCalledExactlyOnceWith('ana@example.test');
    expect(deps.passwords.hash).toHaveBeenCalledExactlyOnceWith('password');
    expect(deps.repository.create).toHaveBeenCalledExactlyOnceWith({
      name: 'Ana',
      email: 'ana@example.test',
      passwordHash: 'stored-hash',
      role: UserRole.ATTENDANT,
    });
    expect(result).toEqual({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.test',
      role: UserRole.ATTENDANT,
      createdAt: credentials().createdAt,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(input.name).toBe(' Ana ');
  });

  it('não concede perfil ADMIN enviado no cadastro público', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('stored-hash');
    deps.repository.create.mockResolvedValue(credentials());
    const attempt = { ...input, role: UserRole.ADMIN };
    await service.register(attempt);
    expect(deps.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.ATTENDANT }),
    );
  });

  it('rejeita e-mail duplicado antes de gerar hash ou gravar', async () => {
    deps.repository.findByEmail.mockResolvedValue(credentials());
    await expect(service.register(input)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email is already registered.',
    });
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    [],
    'text',
    1,
    {},
    { ...input, name: 1 },
    { ...input, email: 1 },
    { ...input, password: 1 },
    { ...input, name: '  ' },
    { ...input, email: '  ' },
    { ...input, password: '' },
  ])('rejeita dados obrigatórios inválidos %j sem acessar infraestrutura', async (data) => {
    await expect(service.register(data as CreateUserDTO)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Name, email and password are required.',
    });
    expect(deps.repository.findByEmail).not.toHaveBeenCalled();
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it.each(['invalid', 'ana@domain', 'ana @example.test'])(
    'rejeita formato de e-mail %s',
    async (email) => {
      await expect(service.register({ ...input, email })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Email must have a valid format.',
      });
      expect(deps.repository.findByEmail).not.toHaveBeenCalled();
    },
  );

  it('rejeita senha com sete caracteres', async () => {
    await expect(service.register({ ...input, password: '1234567' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Password must contain at least 8 characters.',
    });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it('não grava usuário se a geração do hash falhar', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    const failure = new Error('hash failure');
    deps.passwords.hash.mockRejectedValue(failure);
    await expect(service.register(input)).rejects.toBe(failure);
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it('propaga falha de persistência', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('stored-hash');
    const failure = new Error('save failure');
    deps.repository.create.mockRejectedValue(failure);
    await expect(service.register(input)).rejects.toBe(failure);
  });

  it('consulta pelo identificador sem expor hash', async () => {
    deps.repository.findById.mockResolvedValue(credentials());
    const result = await service.getById('user-1');
    expect(deps.repository.findById).toHaveBeenCalledExactlyOnceWith('user-1');
    expect(result).toEqual({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.test',
      role: UserRole.ATTENDANT,
      createdAt: credentials().createdAt,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejeita consulta de usuário inexistente', async () => {
    deps.repository.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
