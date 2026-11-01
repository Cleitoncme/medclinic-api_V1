import { DomainError } from '../domain/domain-error';
import type { Actor, AppointmentStatusPort } from '../ports/appointment-status.port';
import {
  parseAppointmentStatus,
  validateStatusTransition,
} from '../rules/appointment-status.rules';
export class AppointmentStatusService {
  constructor(private readonly repository: AppointmentStatusPort) {}
  async update(rawId: string, actor: Actor, input: unknown) {
    if (!/^[1-9]\d*$/.test(rawId) || Number(rawId) > 2147483647)
      throw new DomainError('DADOS_INVALIDOS', 'Identificador invalido.');
    if (typeof input !== 'object' || input === null || Array.isArray(input))
      throw new DomainError('DADOS_INVALIDOS', 'Dados invalidos.');
    const status = parseAppointmentStatus((input as Record<string, unknown>).status);
    const result = await this.repository.update(Number(rawId), actor, status, (appointment, owns) =>
      validateStatusTransition(appointment.status, status, actor.roles, owns),
    );
    if (!result) throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Agendamento nao encontrado.');
    return {
      ...result,
      startsAt: result.startsAt.toISOString(),
      endsAt: result.endsAt.toISOString(),
    };
  }
}
