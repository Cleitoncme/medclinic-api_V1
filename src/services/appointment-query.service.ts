import { DomainError } from '../domain/domain-error';
import type { Appointment } from '../domain/appointment';
import { UserRole } from '../domain/user';
import type { Actor } from '../ports/appointment-status.port';
import type { AppointmentQueryPort, AppointmentSearch } from '../ports/appointment-query.port';
import { paginated, parsePagination } from '../rules/pagination.rules';
import { parseAppointmentStatus } from '../rules/appointment-status.rules';
export class AppointmentQueryService {
  constructor(private readonly repository: AppointmentQueryPort) {}
  private invalid(): never {
    throw new DomainError('DADOS_INVALIDOS', 'Parametros invalidos.');
  }
  private id(value: unknown): number {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)
      this.invalid();
    return Number(value);
  }
  private date(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) this.invalid();
    const d = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) this.invalid();
    return value;
  }
  private range(query: Record<string, unknown>, required = false): { from?: string; to?: string } {
    const from = query.from === undefined && !required ? undefined : this.date(query.from);
    const to = query.to === undefined && !required ? undefined : this.date(query.to);
    if (
      from &&
      to &&
      (from > to || (required && (Date.parse(to) - Date.parse(from)) / 86400000 + 1 > 31))
    )
      this.invalid();
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }
  private response(a: Appointment) {
    return {
      id: a.id,
      doctorId: a.doctorId,
      patientId: a.patientId,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status,
    };
  }
  async list(query: Record<string, unknown>, actor: Actor) {
    const pagination = parsePagination(query);
    if (!Number.isSafeInteger((pagination.page - 1) * pagination.pageSize)) this.invalid();
    const search: AppointmentSearch = { ...pagination, ...this.range(query) };
    if (query.doctorId !== undefined) search.doctorId = this.id(query.doctorId);
    if (query.patientId !== undefined) search.patientId = this.id(query.patientId);
    if (query.status !== undefined) search.status = parseAppointmentStatus(query.status);
    if (actor.roles.includes(UserRole.DOCTOR) && !actor.roles.includes(UserRole.ADMIN))
      search.ownerId = actor.id;
    const result = await this.repository.list(search);
    return paginated(
      result.data.map((a) => this.response(a)),
      result.total,
      pagination,
    );
  }
  async get(rawId: string, actor: Actor) {
    const appointment = await this.repository.get(this.id(rawId));
    if (!appointment)
      throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Agendamento nao encontrado.');
    if (
      actor.roles.includes(UserRole.DOCTOR) &&
      !actor.roles.includes(UserRole.ADMIN) &&
      appointment.ownerId !== actor.id
    )
      throw new DomainError('ACESSO_NEGADO', 'Agendamento de outro medico.');
    return this.response(appointment);
  }
  async calendar(rawId: string, query: Record<string, unknown>) {
    const doctorId = this.id(rawId);
    const range = this.range(query, true);
    const shifts = await this.repository.schedule(doctorId);
    if (shifts === null) throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Medico nao encontrado.');
    const result = await this.repository.list({ doctorId, ...range, activeOnly: true });
    return {
      workSchedule: { shifts },
      appointments: result.data.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        status: a.status,
      })),
    };
  }
}
