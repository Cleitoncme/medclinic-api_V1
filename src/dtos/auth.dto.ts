import type { UserRole } from '../domain/user';

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  id: string;
  role: UserRole;
}

export interface LoginResponseDTO {
  token: string;
}
