import { DataSource } from 'typeorm';
import { AppointmentEntity } from '../entities/appointment.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import type { AppointmentStatusPort, Actor } from '../ports/appointment-status.port';
import type { Appointment, AppointmentStatus } from '../domain/appointment';
export class AppointmentStatusRepository implements AppointmentStatusPort {
  constructor(private readonly source: DataSource) {}
  update(
    id: number,
    actor: Actor,
    status: AppointmentStatus,
    validate: (appointment: Appointment, owns: boolean) => void,
  ): Promise<Appointment | null> {
    return this.source.transaction(async (manager) => {
      const appointments = manager.getRepository(AppointmentEntity);
      const appointment = await appointments.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) return null;
      const owner = await manager
        .getRepository(DoctorEntity)
        .findOne({ where: { id: appointment.doctorId } });
      validate(appointment, owner?.userId === actor.id);
      appointment.status = status;
      return appointments.save(appointment);
    });
  }
}
