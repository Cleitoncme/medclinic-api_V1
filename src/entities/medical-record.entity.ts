import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity({ name: 'medical_records' })
export class MedicalRecordEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'patient_id', type: 'integer' }) patientId!: number;
  @Column({ name: 'doctor_id', type: 'integer' }) doctorId!: number;
  @Column({ type: 'text' }) text!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
