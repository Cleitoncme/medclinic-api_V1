import { beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../src/services/user.service';
import type { CreateUserDTO } from '../../src/dtos/user.dto';
import { UserRole } from '../../src/domain/user';
import { credentials, dependencies } from './helpers';
describe('UserService', () => {
  let deps: ReturnType<typeof dependencies>;
  let service: UserService;
  const input = {
    name: ' Ana ',
    email: ' ANA@EXAMPLE.TEST ',
    password: 'password',
    roles: [UserRole.SECRETARY],
  };
  beforeEach(() => {
    deps = dependencies();
    service = new UserService(deps.repository, deps.passwords);
  });
  it('normaliza dados, grava hash e retorna somente campos públicos', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('stored-hash');
    deps.repository.create.mockResolvedValue(credentials());
    expect(await service.create(input)).toEqual({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.test',
      roles: [UserRole.SECRETARY],
    });
    expect(deps.repository.findByEmail).toHaveBeenCalledExactlyOnceWith('ana@example.test');
    expect(deps.passwords.hash).toHaveBeenCalledExactlyOnceWith('password');
    expect(deps.repository.create).toHaveBeenCalledExactlyOnceWith({
      name: 'Ana',
      email: 'ana@example.test',
      passwordHash: 'stored-hash',
      roles: [UserRole.SECRETARY],
    });
    expect(input.name).toBe(' Ana ');
  });
  it('permite múltiplos perfis válidos na operação administrativa e remove duplicatas', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('stored-hash');
    deps.repository.create.mockResolvedValue(credentials());
    await service.create({ ...input, roles: [UserRole.ADMIN, UserRole.DOCTOR, UserRole.ADMIN] });
    expect(deps.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [UserRole.ADMIN, UserRole.DOCTOR] }),
    );
  });
  it('rejeita duplicidade sem gerar hash ou gravar', async () => {
    deps.repository.findByEmail.mockResolvedValue(credentials());
    await expect(service.create(input)).rejects.toMatchObject({ code: 'EMAIL_JA_CADASTRADO' });
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    null,
    [],
    1,
    'text',
    {},
    { ...input, name: 1 },
    { ...input, email: 1 },
    { ...input, password: 1 },
    { ...input, name: ' ' },
    { ...input, email: ' ' },
    { ...input, password: '' },
    { ...input, name: 'x'.repeat(121) },
    { ...input, email: 'x'.repeat(161) },
    { ...input, email: 'invalid' },
    { ...input, password: '1234567' },
    { ...input, roles: undefined },
    { ...input, roles: [] },
    { ...input, roles: 'admin' },
    { ...input, roles: ['unknown'] },
    { ...input, roles: [null] },
  ])('rejeita entrada inválida %j antes da persistência', async (data) => {
    await expect(service.create(data as CreateUserDTO)).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    expect(deps.repository.findByEmail).not.toHaveBeenCalled();
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
  it('propaga falha de hash sem gravar', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    const failure = new Error('hash');
    deps.passwords.hash.mockRejectedValue(failure);
    await expect(service.create(input)).rejects.toBe(failure);
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
  it('propaga falha de gravação', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('hash');
    const failure = new Error('save');
    deps.repository.create.mockRejectedValue(failure);
    await expect(service.create(input)).rejects.toBe(failure);
  });
  it('consulta sem expor senha ou hash', async () => {
    deps.repository.findById.mockResolvedValue(credentials());
    expect(await service.getById('user-1')).toEqual({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@example.test',
      roles: [UserRole.SECRETARY],
    });
    expect(deps.repository.findById).toHaveBeenCalledExactlyOnceWith('user-1');
  });
  it('rejeita usuário inexistente', async () => {
    deps.repository.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it('seed cria primeiro administrador', async () => {
    deps.repository.findByEmail.mockResolvedValue(null);
    deps.passwords.hash.mockResolvedValue('hash');
    deps.repository.create.mockResolvedValue({ ...credentials(), roles: [UserRole.ADMIN] });
    expect(await service.ensureAdmin(input)).toBe(true);
    expect(deps.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ roles: [UserRole.ADMIN] }),
    );
  });
  it('seed é idempotente sem trocar credenciais de admin existente', async () => {
    deps.repository.findByEmail.mockResolvedValue({
      ...credentials(),
      roles: [UserRole.DOCTOR, UserRole.ADMIN],
    });
    expect(await service.ensureAdmin(input)).toBe(false);
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
  it('seed falha se e-mail já pertence a não administrador', async () => {
    deps.repository.findByEmail.mockResolvedValue(credentials());
    await expect(service.ensureAdmin(input)).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });
});
