import type { Appointment, AppointmentStatus } from '../domain/appointment';
import type { Shift } from '../domain/work-schedule';
export interface AppointmentSearch {
  doctorId?: number;
  patientId?: number;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  ownerId?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}
export const APPOINTMENT_QUERY = Symbol('APPOINTMENT_QUERY');
export interface AppointmentQueryPort {
  list(search: AppointmentSearch): Promise<{ data: Appointment[]; total: number }>;
  get(id: number): Promise<(Appointment & { ownerId: string }) | null>;
  schedule(id: number): Promise<Shift[] | null>;
}
