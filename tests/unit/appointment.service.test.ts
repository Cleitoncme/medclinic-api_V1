import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentService } from '../../src/services/appointment.service';
import type {
  AppointmentTransaction,
  AppointmentRepositoryPort,
} from '../../src/ports/appointment-repository.port';
import {
  appointmentEnd,
  parseAppointmentInstant,
  periodsOverlap,
} from '../../src/rules/appointment-time.rules';
import type { Appointment } from '../../src/domain/appointment';
const shift = { weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 };
const input = { doctorId: 1, patientId: 2, startsAt: '2026-10-13T08:00:00-03:00' };
const existing: Appointment = {
  id: 1,
  doctorId: 1,
  patientId: 2,
  startsAt: new Date('2026-10-13T11:00:00Z'),
  endsAt: new Date('2026-10-13T11:30:00Z'),
  status: 'scheduled',
};
describe('AppointmentService', () => {
  const tx = {
    lockDoctor: vi.fn<AppointmentTransaction['lockDoctor']>(),
    lockPatient: vi.fn<AppointmentTransaction['lockPatient']>(),
    overlapping: vi.fn<AppointmentTransaction['overlapping']>(),
    create: vi.fn<AppointmentTransaction['create']>(),
  };
  const repo: AppointmentRepositoryPort = { transaction: (work) => work(tx) };
  const service = new AppointmentService(repo);
  beforeEach(() => {
    vi.resetAllMocks();
    tx.lockDoctor.mockResolvedValue({ shifts: [shift] });
    tx.lockPatient.mockResolvedValue(true);
    tx.overlapping.mockResolvedValue([]);
    tx.create.mockImplementation(async (data) => ({ id: 1, ...data }));
  });
  it('calcula fim, fixa scheduled e ignora campos do cliente', async () => {
    expect(await service.create({ ...input, endsAt: '2099-01-01', status: 'done' })).toEqual({
      id: 1,
      ...input,
      startsAt: '2026-10-13T11:00:00.000Z',
      endsAt: '2026-10-13T11:30:00.000Z',
      status: 'scheduled',
    });
    expect(tx.lockDoctor.mock.invocationCallOrder[0]).toBeLessThan(
      tx.lockPatient.mock.invocationCallOrder[0]!,
    );
    expect(tx.lockPatient.mock.invocationCallOrder[0]).toBeLessThan(
      tx.overlapping.mock.invocationCallOrder[0]!,
    );
  });
  it.each([
    null,
    undefined,
    [],
    1,
    {},
    { ...input, doctorId: '1' },
    { ...input, patientId: 0 },
    { ...input, doctorId: 1.5 },
    { ...input, doctorId: 2147483648 },
  ])('rejeita entrada invalida %#', async (value) => {
    await expect(service.create(value)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(tx.create).not.toHaveBeenCalled();
  });
  it('medico inexistente precede escala e nao bloqueia paciente', async () => {
    tx.lockDoctor.mockResolvedValue(null);
    await expect(service.create(input)).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
    expect(tx.lockPatient).not.toHaveBeenCalled();
  });
  it('paciente inexistente precede escala', async () => {
    tx.lockDoctor.mockResolvedValue({ shifts: [] });
    tx.lockPatient.mockResolvedValue(false);
    await expect(service.create(input)).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
  });
  it.each([
    '2026-10-13T07:00:00-03:00',
    '2026-10-13T08:20:00-03:00',
    '2026-10-13T12:00:00-03:00',
    '2026-10-14T08:00:00-03:00',
    '2026-10-13T08:00:01-03:00',
    '2026-10-13T08:00:00.001-03:00',
  ])('rejeita horario fora da escala %s', async (startsAt) => {
    await expect(service.create({ ...input, startsAt })).rejects.toMatchObject({
      code: 'HORARIO_FORA_DA_ESCALA',
    });
    expect(tx.overlapping).not.toHaveBeenCalled();
    expect(tx.create).not.toHaveBeenCalled();
  });
  it('recusa consulta que ultrapassa fim do turno', async () => {
    tx.lockDoctor.mockResolvedValue({ shifts: [{ ...shift, endTime: '08:20' }] });
    await expect(service.create(input)).rejects.toMatchObject({ code: 'HORARIO_FORA_DA_ESCALA' });
  });
  it.each(['scheduled', 'in_progress', 'done'] as const)(
    'medico ocupado inclui %s e precede paciente',
    async (status) => {
      tx.overlapping.mockResolvedValue([{ ...existing, status }]);
      await expect(service.create(input)).rejects.toMatchObject({ code: 'HORARIO_INDISPONIVEL' });
      expect(tx.create).not.toHaveBeenCalled();
    },
  );
  it('paciente ocupado com outro medico', async () => {
    tx.overlapping.mockResolvedValue([{ ...existing, doctorId: 9 }]);
    await expect(service.create(input)).rejects.toMatchObject({ code: 'PACIENTE_INDISPONIVEL' });
    expect(tx.create).not.toHaveBeenCalled();
  });
  it('ignora cancelados, encostados e consultas alheias', async () => {
    tx.overlapping.mockResolvedValue([
      { ...existing, status: 'cancelled' },
      { ...existing, startsAt: existing.endsAt, endsAt: new Date('2026-10-13T12:00:00Z') },
      { ...existing, doctorId: 9, patientId: 9 },
    ]);
    await expect(service.create(input)).resolves.toMatchObject({ status: 'scheduled' });
  });
  it('propaga rollback sem confirmar consulta', async () => {
    tx.create.mockRejectedValue(new Error('rollback'));
    await expect(service.create(input)).rejects.toThrow('rollback');
  });
});
describe('Regras temporais', () => {
  it.each([
    null,
    1,
    '',
    '2026-02-30T08:00:00Z',
    '2026-13-01T08:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T08:00:00',
    '2026-01-01',
    '2026-01-01T08:60:00Z',
    '2026-01-01T08:00:60Z',
  ])('recusa instante invalido %#', (value) => {
    expect(() => parseAppointmentInstant(value)).toThrow();
  });
  it('aceita ano bissexto, fracao e offsets equivalentes', () => {
    expect(parseAppointmentInstant('2024-02-29T08:00:00.5-03:00').toISOString()).toBe(
      '2024-02-29T11:00:00.500Z',
    );
    expect(parseAppointmentInstant('2026-10-13T13:00:00+02:00').toISOString()).toBe(
      existing.startsAt.toISOString(),
    );
  });
  it('converte UTC para dia anterior local e admite fim exato', () => {
    const start = new Date('2026-10-14T02:00:00Z');
    expect(
      appointmentEnd(start, [{ ...shift, startTime: '23:00', endTime: '23:30' }]).toISOString(),
    ).toBe('2026-10-14T02:30:00.000Z');
  });
  it('usa duracao do turno correto', () => {
    expect(
      appointmentEnd(new Date('2026-10-13T17:00:00Z'), [
        shift,
        { ...shift, startTime: '14:00', endTime: '18:00', slotDurationMinutes: 20 },
      ]).toISOString(),
    ).toBe('2026-10-13T17:20:00.000Z');
  });
  it('nao encontra turno quando escala vazia', () => {
    expect(() => appointmentEnd(existing.startsAt, [])).toThrow();
  });
  it.each([
    [0, 10, 20, 30, false],
    [20, 30, 0, 10, false],
    [0, 10, 10, 20, false],
    [10, 20, 0, 10, false],
    [0, 30, 10, 20, true],
    [10, 20, 0, 30, true],
    [0, 20, 10, 30, true],
    [10, 30, 0, 20, true],
    [0, 10, 0, 10, true],
  ])('sobreposicao %#', (a, b, c, d, expected) => {
    expect(
      periodsOverlap(
        new Date(Number(a)),
        new Date(Number(b)),
        new Date(Number(c)),
        new Date(Number(d)),
      ),
    ).toBe(expected);
  });
});
