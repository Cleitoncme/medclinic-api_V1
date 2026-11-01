import { DataSource } from 'typeorm';
import { DoctorEntity } from '../entities/doctor.entity';
import { PatientEntity } from '../entities/patient.entity';
import { AppointmentEntity } from '../entities/appointment.entity';
import type {
  AppointmentRepositoryPort,
  AppointmentTransaction,
} from '../ports/appointment-repository.port';
export class AppointmentRepository implements AppointmentRepositoryPort {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (tx: AppointmentTransaction) => Promise<T>): Promise<T> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const appointments = manager.getRepository(AppointmentEntity);
      return work({
        lockDoctor: (id) =>
          manager
            .getRepository(DoctorEntity)
            .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } }),
        lockPatient: async (id) =>
          Boolean(
            await manager
              .getRepository(PatientEntity)
              .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } }),
          ),
        overlapping: (doctorId, patientId, startsAt, endsAt) =>
          appointments
            .createQueryBuilder('appointment')
            .where('(appointment.doctor_id = :doctorId OR appointment.patient_id = :patientId)', {
              doctorId,
              patientId,
            })
            .andWhere('appointment.status <> :cancelled', { cancelled: 'cancelled' })
            .andWhere('appointment.starts_at < :endsAt AND appointment.ends_at > :startsAt', {
              startsAt,
              endsAt,
            })
            .getMany(),
        create: (input) => appointments.save(appointments.create(input)),
      });
    });
  }
}
