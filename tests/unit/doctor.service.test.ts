import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorService } from '../../src/services/doctor.service';
import type { DoctorRepositoryPort } from '../../src/ports/doctor-repository.port';
import type { NewDoctor } from '../../src/domain/doctor';
import { UserRole } from '../../src/domain/user';
import { DomainError } from '../../src/domain/domain-error';
const input = {
  name: ' Helena ',
  email: ' HELENA@CLINICA.COM ',
  password: 'Senha123!',
  crm: ' CRM-SC-123 ',
};
const doctor = {
  id: 1,
  crm: 'CRM-SC-123',
  user: { id: 'uuid', name: 'Helena', email: 'helena@clinica.com', roles: [UserRole.DOCTOR] },
};
function repository() {
  return {
    createWithUser: vi.fn<DoctorRepositoryPort['createWithUser']>(),
    findById: vi.fn<DoctorRepositoryPort['findById']>(),
    list: vi.fn<DoctorRepositoryPort['list']>(),
  };
}
describe('DoctorService', () => {
  let repo: ReturnType<typeof repository>;
  let passwords: {
    hash: ReturnType<typeof vi.fn<(p: string) => Promise<string>>>;
    compare: ReturnType<typeof vi.fn<(p: string, h: string) => Promise<boolean>>>;
  };
  let service: DoctorService;
  beforeEach(() => {
    repo = repository();
    passwords = { hash: vi.fn().mockResolvedValue('hash'), compare: vi.fn() };
    service = new DoctorService(repo, passwords);
  });
  it('normaliza cadastro, fixa doctor e persiste por uma unica porta atomica sem expor hash', async () => {
    repo.createWithUser.mockResolvedValue({
      ...doctor,
      user: { ...doctor.user, passwordHash: 'hash' },
    } as typeof doctor);
    expect(await service.create({ ...input, roles: ['admin'] } as NewDoctor)).toEqual(doctor);
    expect(passwords.hash).toHaveBeenCalledExactlyOnceWith(input.password);
    expect(repo.createWithUser).toHaveBeenCalledExactlyOnceWith({
      crm: 'CRM-SC-123',
      user: {
        name: 'Helena',
        email: 'helena@clinica.com',
        passwordHash: 'hash',
        roles: ['doctor'],
      },
    });
  });
  it.each([
    null,
    undefined,
    [],
    1,
    {},
    { ...input, name: 1 },
    { ...input, name: ' ' },
    { ...input, name: 'x'.repeat(121) },
    { ...input, email: null },
    { ...input, email: 'invalid' },
    { ...input, email: 'x'.repeat(161) + '@x.y' },
    { ...input, password: 1 },
    { ...input, password: '1234567' },
    { ...input, crm: 1 },
    { ...input, crm: ' ' },
    { ...input, crm: 'x'.repeat(51) },
  ])('recusa dados invalidos %j antes de gravar', async (value) => {
    await expect(service.create(value as NewDoctor)).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    expect(repo.createWithUser).not.toHaveBeenCalled();
    expect(passwords.hash).not.toHaveBeenCalled();
  });
  it.each(['CRM_JA_CADASTRADO', 'EMAIL_JA_CADASTRADO'] as const)(
    'propaga conflito %s',
    async (code) => {
      repo.createWithUser.mockRejectedValue(new DomainError(code, 'conflito'));
      await expect(service.create(input)).rejects.toMatchObject({ code });
    },
  );
  it('falha de hash nao inicia gravacao', async () => {
    passwords.hash.mockRejectedValue(new Error('hash'));
    await expect(service.create(input)).rejects.toThrow('hash');
    expect(repo.createWithUser).not.toHaveBeenCalled();
  });
  it('consulta id e remove campos privados', async () => {
    repo.findById.mockResolvedValue(doctor);
    expect(await service.getById('1')).toEqual(doctor);
    expect(repo.findById).toHaveBeenCalledWith(1);
  });
  it('404 para medico inexistente', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('1')).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it.each(['0', '-1', 'abc', '1.5', '01', '2147483648', '999999999999999999999'])(
    'recusa id %s',
    async (id) => {
      await expect(service.getById(id)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
      expect(repo.findById).not.toHaveBeenCalled();
    },
  );
  it('pagina padrao e dados publicos', async () => {
    repo.list.mockResolvedValue({ data: [doctor], total: 1 });
    const result = await service.list({});
    expect(result.data).toEqual([doctor]);
    expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
  it('normaliza filtro', async () => {
    repo.list.mockResolvedValue({ data: [], total: 0 });
    await service.list({ page: '2', pageSize: '5', name: ' Helena ' });
    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 5, name: 'Helena' });
  });
  it('ignora filtro branco', async () => {
    repo.list.mockResolvedValue({ data: [], total: 0 });
    await service.list({ name: ' ' });
    expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
  it.each([
    { name: [] },
    { name: 1 },
    { page: '0' },
    { pageSize: '101' },
    { page: '9007199254740991', pageSize: '100' },
  ])('recusa filtro %j', async (query) => {
    await expect(service.list(query)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repo.list).not.toHaveBeenCalled();
  });
});
