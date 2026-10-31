import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkScheduleService } from '../../src/services/work-schedule.service';
import type { WorkScheduleRepositoryPort } from '../../src/ports/work-schedule-repository.port';
const shift = { weekDay: 2, startTime: '08:00', endTime: '12:00', slotDurationMinutes: 30 };
describe('WorkScheduleService', () => {
  const repo = {
    find: vi.fn<WorkScheduleRepositoryPort['find']>(),
    replace: vi.fn<WorkScheduleRepositoryPort['replace']>(),
  };
  const service = new WorkScheduleService(repo);
  beforeEach(() => {
    vi.resetAllMocks();
    repo.replace.mockResolvedValue(true);
  });
  it('retorna escala vazia e escala existente', async () => {
    repo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([shift]);
    expect(await service.get('1')).toEqual({ shifts: [] });
    expect(await service.get('1')).toEqual({ shifts: [shift] });
  });
  it('distingue medico inexistente na leitura e na troca', async () => {
    repo.find.mockResolvedValue(null);
    repo.replace.mockResolvedValue(false);
    await expect(service.get('1')).rejects.toMatchObject({ code: 'RECURSO_NAO_ENCONTRADO' });
    await expect(service.replace('1', { shifts: [] })).rejects.toMatchObject({
      code: 'RECURSO_NAO_ENCONTRADO',
    });
  });
  it.each(['0', '-1', 'abc', '1.2', '01', '2147483648', '9007199254740993'])(
    'rejeita id %s',
    async (id) => {
      await expect(service.get(id)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
      await expect(service.replace(id, { shifts: [] })).rejects.toMatchObject({
        code: 'DADOS_INVALIDOS',
      });
      expect(repo.find).not.toHaveBeenCalled();
      expect(repo.replace).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    undefined,
    [],
    1,
    {},
    { shifts: null },
    { shifts: {} },
    { shifts: [null] },
    { shifts: [1] },
    { shifts: [{}] },
  ])('rejeita estrutura invalida %#', async (input) => {
    await expect(service.replace('1', input)).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repo.replace).not.toHaveBeenCalled();
  });
  it.each([
    { weekDay: -1 },
    { weekDay: 7 },
    { weekDay: 1.5 },
    { weekDay: '2' },
    { weekDay: NaN },
    { startTime: '8:00' },
    { startTime: '24:00' },
    { startTime: '08:60' },
    { startTime: 800 },
    { startTime: '08:00:00' },
    { endTime: '25:00' },
    { endTime: null },
    { endTime: '08:00' },
    { endTime: '07:59' },
    { slotDurationMinutes: 0 },
    { slotDurationMinutes: -1 },
    { slotDurationMinutes: '30' },
    { slotDurationMinutes: Infinity },
    { slotDurationMinutes: NaN },
  ])('rejeita campo invalido %#', async (patch) => {
    await expect(service.replace('1', { shifts: [{ ...shift, ...patch }] })).rejects.toMatchObject({
      code: 'DADOS_INVALIDOS',
    });
    expect(repo.replace).not.toHaveBeenCalled();
  });
  it.each([
    ['07:00', '09:00'],
    ['09:00', '13:00'],
    ['09:00', '10:00'],
    ['07:00', '13:00'],
    ['08:00', '12:00'],
  ])('rejeita sobreposicao %s a %s mesmo em ordem inversa', async (startTime, endTime) => {
    await expect(
      service.replace('1', { shifts: [{ ...shift, startTime, endTime }, shift] }),
    ).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
    expect(repo.replace).not.toHaveBeenCalled();
  });
  it('aceita turnos encostados, dias diferentes, duracoes diferentes e preserva ordem e hora local', async () => {
    const shifts = [
      { ...shift, startTime: '12:00', endTime: '18:00', slotDurationMinutes: 20 },
      shift,
      { ...shift, weekDay: 0 },
      { ...shift, weekDay: 6 },
    ];
    const original = structuredClone(shifts);
    expect(await service.replace('1', { shifts })).toEqual({ shifts: original });
    expect(repo.replace).toHaveBeenCalledExactlyOnceWith(1, original);
    expect(shifts).toEqual(original);
  });
  it('permite duracao positiva sem exigir divisibilidade do turno e remove campos extras', async () => {
    const valid = { ...shift, startTime: '00:00', endTime: '23:59', slotDurationMinutes: 17.5 };
    expect(await service.replace('1', { shifts: [{ ...valid, doctorId: 99 }] })).toEqual({
      shifts: [valid],
    });
  });
  it('lista vazia substitui toda a escala', async () => {
    expect(await service.replace('1', { shifts: [] })).toEqual({ shifts: [] });
    expect(repo.replace).toHaveBeenCalledExactlyOnceWith(1, []);
  });
  it('propaga falha de persistencia sem confirmar a alteracao', async () => {
    repo.replace.mockRejectedValue(new Error('rollback'));
    await expect(service.replace('1', { shifts: [shift] })).rejects.toThrow('rollback');
  });
});
