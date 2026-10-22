export enum UserRole {
  ADMIN = 'ADMIN',
  ATTENDANT = 'ATTENDANT',
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserCredentials extends PublicUser {
  passwordHash: string;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}
