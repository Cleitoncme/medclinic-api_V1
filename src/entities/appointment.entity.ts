import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { AppointmentStatus } from '../domain/appointment';
@Entity({ name: 'appointments' })
export class AppointmentEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'doctor_id', type: 'integer' }) doctorId!: number;
  @Column({ name: 'patient_id', type: 'integer' }) patientId!: number;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt!: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt!: Date;
  @Column({ type: 'varchar', length: 20, default: 'scheduled' }) status!: AppointmentStatus;
}
