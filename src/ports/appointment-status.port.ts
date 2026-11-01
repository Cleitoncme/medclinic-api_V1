import type { Appointment, AppointmentStatus } from '../domain/appointment';
import type { UserRole } from '../domain/user';
export interface Actor {
  id: string;
  roles: UserRole[];
}
export const APPOINTMENT_STATUS_REPOSITORY = Symbol('APPOINTMENT_STATUS_REPOSITORY');
export interface AppointmentStatusPort {
  update(
    id: number,
    actor: Actor,
    status: AppointmentStatus,
    validate: (appointment: Appointment, owns: boolean) => void,
  ): Promise<Appointment | null>;
}
