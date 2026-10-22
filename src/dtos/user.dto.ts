import type { UserRole } from '../domain/user';

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}
