import { describe, expect, it, vi } from 'vitest';
import { AppointmentStatusService } from '../../src/services/appointment-status.service';
import { UserRole } from '../../src/domain/user';
import type { AppointmentStatusPort } from '../../src/ports/appointment-status.port';
const actor = { id: 'user', roles: [UserRole.ADMIN] };
const appointment = {
  id: 1,
  doctorId: 2,
  patientId: 3,
  startsAt: new Date('2026-10-13T11:00:00Z'),
  endsAt: new Date('2026-10-13T11:30:00Z'),
  status: 'scheduled' as const,
};
describe('AppointmentStatusService', () => {
  it('atualiza uma transicao valida e devolve instantes UTC', async () => {
    const update = vi
      .fn<AppointmentStatusPort['update']>()
      .mockImplementation(async (id, user, status, validate) => {
        validate(appointment, false);
        return { ...appointment, id, status };
      });
    const result = await new AppointmentStatusService({ update }).update('1', actor, {
      status: 'in_progress',
    });
    expect(result).toMatchObject({
      id: 1,
      status: 'in_progress',
      startsAt: '2026-10-13T11:00:00.000Z',
      endsAt: '2026-10-13T11:30:00.000Z',
    });
  });
  it.each(['0', '-1', 'abc', '1.5', '2147483648'])(
    'rejeita identificador invalido %s',
    async (id) => {
      const update = vi.fn<AppointmentStatusPort['update']>();
      await expect(
        new AppointmentStatusService({ update }).update(id, actor, { status: 'cancelled' }),
      ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
      expect(update).not.toHaveBeenCalled();
    },
  );
  it.each([null, undefined, [], 2, {}, { status: 'unknown' }])(
    'rejeita payload invalido %#',
    async (payload) => {
      const update = vi.fn<AppointmentStatusPort['update']>();
      await expect(
        new AppointmentStatusService({ update }).update('1', actor, payload),
      ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
      expect(update).not.toHaveBeenCalled();
    },
  );
  it('retorna 404 para consulta ausente', async () => {
    const update = vi.fn<AppointmentStatusPort['update']>().mockResolvedValue(null);
    await expect(
      new AppointmentStatusService({ update }).update('1', actor, { status: 'cancelled' }),
    ).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it('impede secretaria de concluir atendimento', async () => {
    const update = vi
      .fn<AppointmentStatusPort['update']>()
      .mockImplementation(async (_id, _user, _status, validate) => {
        validate(appointment, false);
        return appointment;
      });
    await expect(
      new AppointmentStatusService({ update }).update(
        '1',
        { id: 's', roles: [UserRole.SECRETARY] },
        { status: 'in_progress' },
      ),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
  });
});
