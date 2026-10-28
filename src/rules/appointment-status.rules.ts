import { DomainError } from '../domain/domain-error';
import type { AppointmentStatus } from '../domain/appointment';
import { UserRole } from '../domain/user';

const statuses: AppointmentStatus[] = ['scheduled', 'in_progress', 'done', 'cancelled'];
export function parseAppointmentStatus(value: unknown): AppointmentStatus {
  if (typeof value !== 'string' || !statuses.includes(value as AppointmentStatus))
    throw new DomainError('DADOS_INVALIDOS', 'Status invalido.');
  return value as AppointmentStatus;
}
export function validateStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  roles: UserRole[],
  ownsAppointment: boolean,
): void {
  const allowed =
    (from === 'scheduled' && (to === 'in_progress' || to === 'cancelled')) ||
    (from === 'in_progress' && (to === 'done' || to === 'cancelled'));
  if (!allowed) throw new DomainError('TRANSICAO_INVALIDA', 'Transicao de status invalida.');
  const authorized =
    roles.includes(UserRole.ADMIN) ||
    (roles.includes(UserRole.DOCTOR) && ownsAppointment) ||
    (roles.includes(UserRole.SECRETARY) && from === 'scheduled' && to === 'cancelled');
  if (!authorized) throw new DomainError('ACESSO_NEGADO', 'Sem permissao para esta transicao.');
}
