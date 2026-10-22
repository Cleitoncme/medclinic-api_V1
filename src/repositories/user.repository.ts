import type { DeepPartial, Repository } from 'typeorm';

import { User } from '../entities/user.entity';

export class UserRepository {
  public constructor(private readonly repository: Repository<User>) {}

  public async create(userData: DeepPartial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  public async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  public async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }
}
