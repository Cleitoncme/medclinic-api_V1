import { DataSource, In } from 'typeorm';
import { MedicalRecordEntity } from '../entities/medical-record.entity';
import { PatientEntity } from '../entities/patient.entity';
import { DoctorEntity } from '../entities/doctor.entity';
import { AppointmentEntity } from '../entities/appointment.entity';
import type { MedicalRecordPort } from '../ports/medical-record.port';
import type { Pagination } from '../rules/pagination.rules';
export class MedicalRecordRepository implements MedicalRecordPort {
  constructor(private readonly source: DataSource) {}
  async patientExists(id: number) {
    return this.source.getRepository(PatientEntity).existsBy({ id });
  }
  async linkedDoctorId(patientId: number, userId: string) {
    const doctor = await this.source
      .getRepository(DoctorEntity)
      .createQueryBuilder('doctor')
      .where('CAST(doctor.user_id AS text) = :userId', { userId })
      .getOne();
    if (!doctor) return null;
    const exists = await this.source
      .getRepository(AppointmentEntity)
      .existsBy({ patientId, doctorId: doctor.id, status: In(['in_progress', 'done']) });
    return exists ? doctor.id : null;
  }
  async create(patientId: number, doctorId: number, text: string) {
    const repository = this.source.getRepository(MedicalRecordEntity);
    return repository.save(repository.create({ patientId, doctorId, text }));
  }
  async list(patientId: number, pagination: Pagination) {
    const [data, total] = await this.source.getRepository(MedicalRecordEntity).findAndCount({
      where: { patientId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return { data, total };
  }
}
