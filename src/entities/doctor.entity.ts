import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Shift } from '../domain/work-schedule';
import { User } from './user.entity';
@Entity({ name: 'doctors' })
@Index('UQ_doctors_crm', ['crm'], { unique: true })
export class DoctorEntity {
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) shifts!: Shift[];
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 50 }) crm!: string;
  @Column({ name: 'user_id', type: 'uuid', unique: true }) userId!: string;
  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
