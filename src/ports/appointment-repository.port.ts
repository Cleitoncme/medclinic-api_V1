import type { Appointment, NewAppointment } from '../domain/appointment';
import type { Shift } from '../domain/work-schedule';
export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');
export interface AppointmentTransaction {
  lockDoctor(id: number): Promise<{ shifts: Shift[] } | null>;
  lockPatient(id: number): Promise<boolean>;
  overlapping(
    doctorId: number,
    patientId: number,
    startsAt: Date,
    endsAt: Date,
  ): Promise<Appointment[]>;
  create(input: NewAppointment): Promise<Appointment>;
}
export interface AppointmentRepositoryPort {
  transaction<T>(work: (transaction: AppointmentTransaction) => Promise<T>): Promise<T>;
}
