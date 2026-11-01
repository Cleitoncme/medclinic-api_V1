import type { DataSource } from 'typeorm';
import { DoctorEntity } from '../entities/doctor.entity';
import { User } from '../entities/user.entity';
import type { DoctorRegistration } from '../domain/doctor';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { Pagination } from '../rules/pagination.rules';
export class DoctorRepository implements DoctorRepositoryPort {
  constructor(private readonly source: DataSource) {}
  async createWithUser(input: DoctorRegistration): Promise<DoctorEntity> {
    return this.source.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const user = await users.save(users.create(input.user));
      const doctors = manager.getRepository(DoctorEntity);
      return doctors.save(doctors.create({ crm: input.crm, userId: user.id, user }));
    });
  }
  findById(id: number): Promise<DoctorEntity | null> {
    return this.source
      .getRepository(DoctorEntity)
      .findOne({ where: { id }, relations: { user: true } });
  }
  async list(query: Pagination & { name?: string }) {
    const builder = this.source
      .getRepository(DoctorEntity)
      .createQueryBuilder('doctor')
      .innerJoinAndSelect('doctor.user', 'user');
    if (query.name) {
      const escaped = query.name.replace(/[\\%_]/g, '\\$&');
      builder.andWhere('user.name ILIKE :name', { name: '%' + escaped + '%' });
    }
    const [data, total] = await builder
      .orderBy('doctor.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return { data, total };
  }
}
