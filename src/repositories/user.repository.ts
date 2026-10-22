import type { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import type { NewUser } from '../domain/user';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export class UserRepository implements UserRepositoryPort {
  public constructor(private readonly repository: Repository<User>) {}

  public async create(userData: NewUser): Promise<User> {
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
