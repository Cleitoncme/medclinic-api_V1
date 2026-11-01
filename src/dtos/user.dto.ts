import type { UserRole } from '../domain/user';
export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  roles: UserRole[];
}
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}
