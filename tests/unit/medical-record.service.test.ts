import { describe, expect, it, vi } from 'vitest';
import { MedicalRecordService } from '../../src/services/medical-record.service';
import type { MedicalRecordPort } from '../../src/ports/medical-record.port';
import { UserRole } from '../../src/domain/user';
const doctor = { id: 'doctor-user', roles: [UserRole.DOCTOR] };
const admin = { id: 'admin-user', roles: [UserRole.ADMIN] };
const secretary = { id: 'secretary-user', roles: [UserRole.SECRETARY] };
const record = {
  id: 4,
  patientId: 1,
  doctorId: 2,
  text: 'Atendimento',
  createdAt: new Date('2026-10-13T11:25:00Z'),
};
function setup() {
  const repository = {
    patientExists: vi.fn<MedicalRecordPort['patientExists']>().mockResolvedValue(true),
    linkedDoctorId: vi.fn<MedicalRecordPort['linkedDoctorId']>().mockResolvedValue(2),
    create: vi.fn<MedicalRecordPort['create']>().mockResolvedValue(record),
    list: vi.fn<MedicalRecordPort['list']>().mockResolvedValue({ data: [record], total: 1 }),
  };
  return { repository, service: new MedicalRecordService(repository) };
}
describe('MedicalRecordService', () => {
  it('registra com autoria do token ignorando doctorId do corpo', async () => {
    const { service, repository } = setup();
    const result = await service.create('1', doctor, { text: ' Atendimento ', doctorId: 99 });
    expect(repository.linkedDoctorId).toHaveBeenCalledWith(1, doctor.id);
    expect(repository.create).toHaveBeenCalledWith(1, 2, 'Atendimento');
    expect(result).toEqual({ ...record, createdAt: '2026-10-13T11:25:00.000Z' });
  });
  it.each([null, undefined, [], {}, { text: '' }, { text: '  ' }, { text: 4 }])(
    'recusa texto invalido %#',
    async (body) => {
      const { service, repository } = setup();
      await expect(service.create('1', doctor, body)).rejects.toMatchObject({
        code: 'DADOS_INVALIDOS',
      });
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it.each(['0', '-1', '1.2', '2147483648', 'a'])('rejeita id %s', async (id) => {
    const { service } = setup();
    await expect(service.create(id, doctor, { text: 'a' })).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    await expect(service.list(id, admin, {})).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
  });
  it.each([admin, secretary])('recusa escrita de perfil nao medico %#', async (actor) => {
    const { service, repository } = setup();
    await expect(service.create('1', actor, { text: 'a' })).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('nega medico sem vinculo para escrita e leitura', async () => {
    const { service, repository } = setup();
    repository.linkedDoctorId.mockResolvedValue(null);
    await expect(service.create('1', doctor, { text: 'a' })).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    await expect(service.list('1', doctor, {})).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
  });
  it('retorna 404 para paciente ausente', async () => {
    const { service, repository } = setup();
    repository.patientExists.mockResolvedValue(false);
    await expect(service.create('1', doctor, { text: 'a' })).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
    await expect(service.list('1', admin, {})).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it('lista para medico vinculado com pagina e datas', async () => {
    const { service, repository } = setup();
    const result = await service.list('1', doctor, { page: '2', pageSize: '1' });
    expect(repository.list).toHaveBeenCalledWith(1, { page: 2, pageSize: 1 });
    expect(result.meta).toEqual({ total: 1, page: 2, pageSize: 1, totalPages: 1 });
    expect(result.data[0].createdAt).toBe('2026-10-13T11:25:00.000Z');
  });
  it('admin pode ler sem vinculo', async () => {
    const { service, repository } = setup();
    await service.list('1', admin, {});
    expect(repository.linkedDoctorId).not.toHaveBeenCalled();
  });
  it('secretaria nao le', async () => {
    const { service, repository } = setup();
    await expect(service.list('1', secretary, {})).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('perfil misto doctor permite escrita com vinculo; admin permite leitura', async () => {
    const { service, repository } = setup();
    const actor = {
      id: 'doctor-user',
      roles: [UserRole.ADMIN, UserRole.DOCTOR, UserRole.SECRETARY],
    };
    await service.create('1', actor, { text: 'a' });
    repository.linkedDoctorId.mockResolvedValue(null);
    await expect(service.create('1', actor, { text: 'a' })).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
    await service.list('1', actor, {});
  });
  it.each([{ page: '0' }, { pageSize: '101' }, { page: '9007199254740991', pageSize: '100' }])(
    'recusa paginacao invalida %#',
    async (query) => {
      const { service } = setup();
      await expect(service.list('1', admin, query)).rejects.toMatchObject({
        code: 'DADOS_INVALIDOS',
      });
    },
  );
});
