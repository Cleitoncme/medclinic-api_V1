import type { Repository } from 'typeorm';
import { PatientEntity } from '../entities/patient.entity';
import type { NewPatient, Patient } from '../domain/patient';
import type { PatientRepositoryPort, PatientSearch } from '../ports/patient-repository.port';

export class PatientRepository implements PatientRepositoryPort {
  constructor(private readonly repository: Repository<PatientEntity>) {}
  async create(input: NewPatient): Promise<Patient> {
    return this.repository.save(this.repository.create(input));
  }
  async findByCpf(cpf: string): Promise<Patient | null> {
    return this.repository.findOne({ where: { cpf }, withDeleted: true });
  }
  async findById(id: number): Promise<Patient | null> {
    return this.repository.findOne({ where: { id } });
  }
  async list(search: PatientSearch) {
    const query = this.repository.createQueryBuilder('patient');
    if (search.name) {
      const literal = search.name.replace(/[\\%_]/g, '\\$&');
      query.andWhere('patient.name ILIKE :name', { name: `%${literal}%` });
    }
    const [data, total] = await query
      .orderBy('patient.id', 'ASC')
      .skip((search.page - 1) * search.pageSize)
      .take(search.pageSize)
      .getManyAndCount();
    return { data, total };
  }
  async updateName(id: number, name: string): Promise<Patient | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update(PatientEntity)
      .set({ name })
      .where('id = :id', { id })
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected ? this.findById(id) : null;
  }
  async remove(id: number): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .softDelete()
      .where('id = :id', { id })
      .andWhere('deleted_at IS NULL')
      .execute();
    return result.affected === 1;
  }
}
