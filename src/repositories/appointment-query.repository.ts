import { DataSource } from 'typeorm';
import { AppointmentEntity } from '../entities/appointment.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import type { AppointmentQueryPort, AppointmentSearch } from '../ports/appointment-query.port';
export class AppointmentQueryRepository implements AppointmentQueryPort {
  constructor(private readonly source: DataSource) {}
  async list(search: AppointmentSearch) {
    const q = this.source.getRepository(AppointmentEntity).createQueryBuilder('a');
    if (search.ownerId)
      q.innerJoin(DoctorEntity, 'd', 'd.id = a.doctor_id AND d.user_id = :ownerId', {
        ownerId: search.ownerId,
      });
    if (search.doctorId !== undefined)
      q.andWhere('a.doctor_id = :doctorId', { doctorId: search.doctorId });
    if (search.patientId !== undefined)
      q.andWhere('a.patient_id = :patientId', { patientId: search.patientId });
    if (search.status) q.andWhere('a.status = :status', { status: search.status });
    if (search.activeOnly) q.andWhere('a.status <> :cancelled', { cancelled: 'cancelled' });
    if (search.from)
      q.andWhere(
        "a.starts_at >= (CAST(:from AS date)::timestamp AT TIME ZONE 'America/Sao_Paulo')",
        { from: search.from },
      );
    if (search.to)
      q.andWhere(
        "a.starts_at < ((CAST(:to AS date) + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')",
        { to: search.to },
      );
    q.orderBy('a.starts_at', 'ASC').addOrderBy('a.id', 'ASC');
    if (search.page !== undefined && search.pageSize !== undefined)
      q.skip((search.page - 1) * search.pageSize).take(search.pageSize);
    const [data, total] = await q.getManyAndCount();
    return { data, total };
  }
  async get(id: number) {
    const a = await this.source.getRepository(AppointmentEntity).findOneBy({ id });
    if (!a) return null;
    const doctor = await this.source
      .getRepository(DoctorEntity)
      .findOneByOrFail({ id: a.doctorId });
    return { ...a, ownerId: doctor.userId };
  }
  async schedule(id: number) {
    const doctor = await this.source.getRepository(DoctorEntity).findOneBy({ id });
    return doctor ? doctor.shifts : null;
  }
}
