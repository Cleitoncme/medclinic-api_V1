import { DomainError } from '../domain/domain-error';
import type { AppointmentResponse } from '../domain/appointment';
import type { AppointmentRepositoryPort } from '../ports/appointment-repository.port';
import {
  appointmentEnd,
  parseAppointmentInstant,
  periodsOverlap,
} from '../rules/appointment-time.rules';
export class AppointmentService {
  constructor(private readonly repository: AppointmentRepositoryPort) {}
  async create(input: unknown): Promise<AppointmentResponse> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) this.invalid();
    const body = input as Record<string, unknown>;
    const doctorId = this.id(body.doctorId);
    const patientId = this.id(body.patientId);
    const startsAt = parseAppointmentInstant(body.startsAt);
    return this.repository.transaction(async (tx) => {
      const doctor = await tx.lockDoctor(doctorId);
      if (!doctor || !(await tx.lockPatient(patientId)))
        throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Medico ou paciente nao encontrado.');
      const endsAt = appointmentEnd(startsAt, doctor.shifts);
      const appointments = await tx.overlapping(doctorId, patientId, startsAt, endsAt);
      const active = appointments.filter(
        (a) => a.status !== 'cancelled' && periodsOverlap(startsAt, endsAt, a.startsAt, a.endsAt),
      );
      if (active.some((a) => a.doctorId === doctorId))
        throw new DomainError('HORARIO_INDISPONIVEL', 'Medico ja possui consulta nesse periodo.');
      if (active.some((a) => a.patientId === patientId))
        throw new DomainError(
          'PACIENTE_INDISPONIVEL',
          'Paciente ja possui consulta nesse periodo.',
        );
      const saved = await tx.create({ doctorId, patientId, startsAt, endsAt, status: 'scheduled' });
      return {
        id: saved.id,
        doctorId: saved.doctorId,
        patientId: saved.patientId,
        startsAt: saved.startsAt.toISOString(),
        endsAt: saved.endsAt.toISOString(),
        status: saved.status,
      };
    });
  }
  private id(value: unknown): number {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 2147483647
    )
      this.invalid();
    return value;
  }
  private invalid(): never {
    throw new DomainError('DADOS_INVALIDOS', 'Dados de agendamento invalidos.');
  }
}
