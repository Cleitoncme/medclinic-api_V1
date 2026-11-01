import { DomainError } from '../domain/domain-error';
import type { Shift, WorkSchedule } from '../domain/work-schedule';
import type { WorkScheduleRepositoryPort } from '../ports/work-schedule-repository.port';
export class WorkScheduleService {
  constructor(private readonly repository: WorkScheduleRepositoryPort) {}
  async get(rawId: string): Promise<WorkSchedule> {
    const shifts = await this.repository.find(this.id(rawId));
    if (shifts === null) this.missing();
    return { shifts };
  }
  async replace(rawId: string, input: unknown): Promise<WorkSchedule> {
    const id = this.id(rawId);
    if (
      typeof input !== 'object' ||
      input === null ||
      !('shifts' in input) ||
      !Array.isArray(input.shifts)
    )
      this.invalid();
    const shifts: Shift[] = input.shifts.map((value: unknown) => {
      if (typeof value !== 'object' || value === null) this.invalid();
      const shift = value as Record<string, unknown>;
      if (
        typeof shift.weekDay !== 'number' ||
        !Number.isInteger(shift.weekDay) ||
        shift.weekDay < 0 ||
        shift.weekDay > 6 ||
        !this.time(shift.startTime) ||
        !this.time(shift.endTime) ||
        shift.startTime >= shift.endTime ||
        typeof shift.slotDurationMinutes !== 'number' ||
        !Number.isFinite(shift.slotDurationMinutes) ||
        shift.slotDurationMinutes <= 0
      )
        this.invalid();
      return {
        weekDay: shift.weekDay,
        startTime: shift.startTime,
        endTime: shift.endTime,
        slotDurationMinutes: shift.slotDurationMinutes,
      };
    });
    const ordered = [...shifts].sort(
      (a, b) => a.weekDay - b.weekDay || a.startTime.localeCompare(b.startTime),
    );
    for (let i = 1; i < ordered.length; i++) {
      const previous = ordered[i - 1]!;
      const current = ordered[i]!;
      if (previous.weekDay === current.weekDay && current.startTime < previous.endTime)
        this.invalid();
    }
    if (!(await this.repository.replace(id, shifts))) this.missing();
    return { shifts };
  }
  private time(value: unknown): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }
  private id(value: string): number {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2147483647) this.invalid();
    return id;
  }
  private invalid(): never {
    throw new DomainError(
      'DADOS_INVALIDOS',
      'Escala ou identificador invalido; turnos nao podem se sobrepor.',
    );
  }
  private missing(): never {
    throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Medico nao encontrado.');
  }
}
