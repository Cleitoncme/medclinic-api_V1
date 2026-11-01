import { describe, expect, it, vi } from 'vitest';
import { AppointmentQueryService } from '../../src/services/appointment-query.service';
import type { AppointmentQueryPort } from '../../src/ports/appointment-query.port';
import { UserRole } from '../../src/domain/user';
const admin = { id: 'admin', roles: [UserRole.ADMIN] };
const doctor = { id: 'owner', roles: [UserRole.DOCTOR] };
const a = {
  id: 1,
  doctorId: 2,
  patientId: 3,
  startsAt: new Date('2026-10-13T11:00Z'),
  endsAt: new Date('2026-10-13T11:30Z'),
  status: 'scheduled' as const,
};
function setup() {
  const repository = {
    list: vi.fn<AppointmentQueryPort['list']>().mockResolvedValue({ data: [a], total: 1 }),
    get: vi.fn<AppointmentQueryPort['get']>().mockResolvedValue({ ...a, ownerId: 'owner' }),
    schedule: vi.fn<AppointmentQueryPort['schedule']>().mockResolvedValue([]),
  };
  return { repository, service: new AppointmentQueryService(repository) };
}
describe('AppointmentQueryService', () => {
  it('pagina, combina filtros e serializa datas sem expor identidade do usuario', async () => {
    const { service, repository } = setup();
    const result = await service.list(
      {
        doctorId: '2',
        patientId: '3',
        status: 'scheduled',
        from: '2026-10-13',
        to: '2026-10-13',
        page: '2',
        pageSize: '1',
      },
      admin,
    );
    expect(repository.list).toHaveBeenCalledWith({
      doctorId: 2,
      patientId: 3,
      status: 'scheduled',
      from: '2026-10-13',
      to: '2026-10-13',
      page: 2,
      pageSize: 1,
    });
    expect(result.meta).toEqual({ total: 1, page: 2, pageSize: 1, totalPages: 1 });
    expect(result.data[0]).toEqual({
      ...a,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    });
  });
  it('aplica valores padrao e lista vazia', async () => {
    const { service, repository } = setup();
    repository.list.mockResolvedValue({ data: [], total: 0 });
    expect((await service.list({}, admin)).meta).toEqual({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });
  it.each([[UserRole.DOCTOR], [UserRole.DOCTOR, UserRole.SECRETARY]])(
    'forca posse mesmo com filtro alheio %#',
    async (...roles) => {
      const { service, repository } = setup();
      await service.list({ doctorId: '9' }, { ...doctor, roles });
      expect(repository.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        doctorId: 9,
        ownerId: 'owner',
      });
    },
  );
  it('admin com perfil doctor pode consultar todos', async () => {
    const { service, repository } = setup();
    await service.list({}, { id: 'admin', roles: [UserRole.ADMIN, UserRole.DOCTOR] });
    expect(repository.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
  it.each([
    { doctorId: '0' },
    { patientId: '2147483648' },
    { doctorId: ['1'] },
    { status: 'invalid' },
    { from: '2026-02-30' },
    { to: 'bad' },
    { from: '2026-10-14', to: '2026-10-13' },
    { page: '0' },
    { pageSize: '101' },
    { page: '9007199254740991', pageSize: '100' },
  ])('recusa filtro invalido %#', async (query) => {
    const { service, repository } = setup();
    await expect(service.list(query, admin)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it.each([{ from: '2024-02-29' }, { to: '2026-10-13' }])(
    'permite limites opcionais separados %#',
    async (query) => {
      const { service, repository } = setup();
      await service.list(query, admin);
      expect(repository.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, ...query });
    },
  );
  it('detalha consulta propria sem ownerId', async () => {
    const { service } = setup();
    expect(await service.get('1', doctor)).toEqual({
      ...a,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    });
  });
  it('nega detalhe alheio', async () => {
    const { service } = setup();
    await expect(service.get('1', { ...doctor, id: 'other' })).rejects.toMatchObject({
      code: 'ACESSO_NEGADO',
    });
  });
  it('admin e secretaria podem detalhar', async () => {
    const { service } = setup();
    for (const roles of [[UserRole.ADMIN, UserRole.DOCTOR], [UserRole.SECRETARY]])
      expect((await service.get('1', { id: 'other', roles })).id).toBe(1);
  });
  it('retorna 404 para detalhe ausente', async () => {
    const { service, repository } = setup();
    repository.get.mockResolvedValue(null);
    await expect(service.get('1', admin)).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it('valida id do detalhe antes de consultar', async () => {
    const { service, repository } = setup();
    await expect(service.get('abc', admin)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repository.get).not.toHaveBeenCalled();
  });
  it('agenda inclui 31 dias e somente agendamentos ativos sem paginacao', async () => {
    const { service, repository } = setup();
    const result = await service.calendar('2', { from: '2026-10-01', to: '2026-10-31' });
    expect(repository.list).toHaveBeenCalledWith({
      doctorId: 2,
      from: '2026-10-01',
      to: '2026-10-31',
      activeOnly: true,
    });
    expect(result.workSchedule).toEqual({ shifts: [] });
    expect(result.appointments[0]).toEqual({
      id: 1,
      patientId: 3,
      status: 'scheduled',
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    });
  });
  it.each([
    {},
    { from: '2026-10-01' },
    { to: '2026-10-01' },
    { from: '2026-10-01', to: '2026-11-01' },
    { from: '2026-02-29', to: '2026-03-01' },
    { from: '2026-12-01', to: '2026-11-01' },
  ])('recusa periodo da agenda invalido %#', async (query) => {
    const { service, repository } = setup();
    await expect(service.calendar('2', query)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repository.schedule).not.toHaveBeenCalled();
  });
  it('retorna 404 para medico ausente', async () => {
    const { service, repository } = setup();
    repository.schedule.mockResolvedValue(null);
    await expect(
      service.calendar('2', { from: '2026-10-13', to: '2026-10-13' }),
    ).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
    expect(repository.list).not.toHaveBeenCalled();
  });
});
