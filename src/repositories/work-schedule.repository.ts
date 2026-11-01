import { DataSource } from 'typeorm';
import { DoctorEntity } from '../entities/doctor.entity';
import type { Shift } from '../domain/work-schedule';
import type { WorkScheduleRepositoryPort } from '../ports/work-schedule-repository.port';
export class WorkScheduleRepository implements WorkScheduleRepositoryPort {
  constructor(private readonly source: DataSource) {}
  async find(doctorId: number): Promise<Shift[] | null> {
    const doctor = await this.source
      .getRepository(DoctorEntity)
      .findOne({ where: { id: doctorId }, select: { id: true, shifts: true } });
    return doctor ? doctor.shifts : null;
  }
  async replace(doctorId: number, shifts: Shift[]): Promise<boolean> {
    return this.source.transaction(async (manager) => {
      const repository = manager.getRepository(DoctorEntity);
      // Agendamentos devem adquirir o mesmo lock antes de consultar a escala.
      const doctor = await repository.findOne({
        where: { id: doctorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!doctor) return false;
      await repository.update(doctorId, { shifts });
      return true;
    });
  }
}
