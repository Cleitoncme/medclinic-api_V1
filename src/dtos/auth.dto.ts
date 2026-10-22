import type { UserRole } from '../domain/user';

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  id: string;
  roles: UserRole[];
}

export interface LoginResponseDTO {
  accessToken: string;
}
