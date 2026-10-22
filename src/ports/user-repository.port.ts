import type { NewUser, PublicUser, UserCredentials } from '../domain/user';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort {
  create(user: NewUser): Promise<PublicUser>;
  findByEmail(email: string): Promise<PublicUser | null>;
  findByEmailWithPassword(email: string): Promise<UserCredentials | null>;
  findById(id: string): Promise<PublicUser | null>;
}
