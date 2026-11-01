export enum UserRole {
  ADMIN = 'admin',
  SECRETARY = 'secretary',
  DOCTOR = 'doctor',
}
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  createdAt: Date;
}
export interface UserCredentials extends PublicUser {
  passwordHash: string;
}
export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
}
