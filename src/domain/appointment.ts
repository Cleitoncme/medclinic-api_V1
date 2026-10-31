export type AppointmentStatus = 'scheduled' | 'in_progress' | 'done' | 'cancelled';
export interface Appointment {
  id: number;
  doctorId: number;
  patientId: number;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}
export type NewAppointment = Omit<Appointment, 'id'>;
export interface AppointmentResponse extends Omit<Appointment, 'startsAt' | 'endsAt'> {
  startsAt: string;
  endsAt: string;
}
