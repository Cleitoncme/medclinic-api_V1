import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientService } from '../../src/services/patient.service';
import type { PatientRepositoryPort } from '../../src/ports/patient-repository.port';
import type { NewPatient, Patient } from '../../src/domain/patient';

const patient: Patient = {
  id: 1,
  name: 'Carlos',
  cpf: '00123456789',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};
function repository() {
  return {
    create: vi.fn<PatientRepositoryPort['create']>(),
    findByCpf: vi.fn<PatientRepositoryPort['findByCpf']>(),
    findById: vi.fn<PatientRepositoryPort['findById']>(),
    list: vi.fn<PatientRepositoryPort['list']>(),
    updateName: vi.fn<PatientRepositoryPort['updateName']>(),
    remove: vi.fn<PatientRepositoryPort['remove']>(),
  } satisfies PatientRepositoryPort;
}
describe('PatientService', () => {
  let repo: ReturnType<typeof repository>;
  let service: PatientService;
  beforeEach(() => {
    repo = repository();
    service = new PatientService(repo);
  });
  it('normaliza nome, preserva CPF com zeros e retorna apenas dados públicos', async () => {
    repo.findByCpf.mockResolvedValue(null);
    repo.create.mockResolvedValue({ ...patient, deletedAt: null } as Patient);
    expect(await service.create({ name: ' Carlos ', cpf: patient.cpf })).toEqual(patient);
    expect(repo.create).toHaveBeenCalledExactlyOnceWith({ name: 'Carlos', cpf: patient.cpf });
    expect(repo.findByCpf).toHaveBeenCalledExactlyOnceWith(patient.cpf);
  });
  it('aceita 11 dígitos sem validar dígito verificador', async () => {
    repo.findByCpf.mockResolvedValue(null);
    repo.create.mockResolvedValue({ ...patient, cpf: '00000000000' });
    expect((await service.create({ name: 'Carlos', cpf: '00000000000' })).cpf).toBe('00000000000');
  });
  it.each([
    undefined,
    null,
    [],
    {},
    'text',
    1,
    { name: 1, cpf: patient.cpf },
    { name: ' ', cpf: patient.cpf },
    { name: 'x'.repeat(121), cpf: patient.cpf },
    { name: 'Carlos' },
    { name: 'Carlos', cpf: 12345678901 },
    { name: 'Carlos', cpf: '123' },
    { name: 'Carlos', cpf: '123456789012' },
    { name: 'Carlos', cpf: '123.456.789-01' },
    { name: 'Carlos', cpf: 'abcdefghijk' },
    { name: 'Carlos', cpf: ' 01234567890' },
  ])('recusa cadastro inválido %j sem persistir', async (input) => {
    await expect(service.create(input as NewPatient)).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    expect(repo.findByCpf).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('recusa CPF reservado, inclusive de registro removido', async () => {
    repo.findByCpf.mockResolvedValue(patient);
    await expect(service.create({ name: 'Outro', cpf: patient.cpf })).rejects.toMatchObject({
      code: 'CPF_JA_CADASTRADO',
    });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('propaga falha do repositório', async () => {
    repo.findByCpf.mockResolvedValue(null);
    const failure = new Error('write');
    repo.create.mockRejectedValue(failure);
    await expect(service.create({ name: 'Carlos', cpf: patient.cpf })).rejects.toBe(failure);
  });
  it('lista com padrões e envelope, sem campos internos', async () => {
    repo.list.mockResolvedValue({ data: [{ ...patient, deletedAt: null } as Patient], total: 21 });
    expect(await service.list({})).toEqual({
      data: [patient],
      meta: { total: 21, page: 1, pageSize: 20, totalPages: 2 },
    });
    expect(repo.list).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
  });
  it('encaminha filtro parcial e paginação sem alterar a caixa do nome', async () => {
    repo.list.mockResolvedValue({ data: [], total: 0 });
    expect((await service.list({ name: ' CAR ', page: '2', pageSize: '1' })).data).toEqual([]);
    expect(repo.list).toHaveBeenCalledExactlyOnceWith({ name: 'CAR', page: 2, pageSize: 1 });
  });
  it('trata filtro vazio como ausência de filtro', async () => {
    repo.list.mockResolvedValue({ data: [], total: 0 });
    await service.list({ name: ' ' });
    expect(repo.list).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
  });
  it.each([
    { name: [] },
    { name: {} },
    { name: 1 },
    { page: '0' },
    { pageSize: '101' },
    { page: '9007199254740991', pageSize: '100' },
  ])('recusa filtros inválidos %j', async (query) => {
    await expect(service.list(query)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repo.list).not.toHaveBeenCalled();
  });
  it('consulta ID numérico e retorna dados públicos', async () => {
    repo.findById.mockResolvedValue(patient);
    expect(await service.getById('1')).toEqual(patient);
    expect(repo.findById).toHaveBeenCalledExactlyOnceWith(1);
  });
  it.each(['0', '-1', 'abc', '1.5', '1 OR 1=1', '2147483648', '9007199254740992', ''])(
    'recusa ID inválido %s',
    async (id) => {
      await expect(service.getById(id)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
      expect(repo.findById).not.toHaveBeenCalled();
    },
  );
  it('inexistente ou removido não é encontrado', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('1')).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it('altera somente o nome', async () => {
    repo.updateName.mockResolvedValue({ ...patient, name: 'Novo' });
    expect(await service.update('1', { name: ' Novo ' })).toEqual({ ...patient, name: 'Novo' });
    expect(repo.updateName).toHaveBeenCalledExactlyOnceWith(1, 'Novo');
  });
  it.each([
    undefined,
    null,
    [],
    {},
    'text',
    { name: ' ' },
    { name: 1 },
    { cpf: '11111111111' },
    { name: 'Novo', cpf: '11111111111' },
  ])('recusa PATCH inválido %j', async (input) => {
    await expect(service.update('1', input as { name: string })).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    expect(repo.updateName).not.toHaveBeenCalled();
  });
  it('alteração de inexistente retorna não encontrado', async () => {
    repo.updateName.mockResolvedValue(null);
    await expect(service.update('1', { name: 'Novo' })).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it('remove sem retornar corpo', async () => {
    repo.remove.mockResolvedValue(true);
    expect(await service.remove('1')).toBeUndefined();
    expect(repo.remove).toHaveBeenCalledExactlyOnceWith(1);
  });
  it('remoção repetida ou inexistente retorna não encontrado', async () => {
    repo.remove.mockResolvedValue(false);
    await expect(service.remove('1')).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
});
