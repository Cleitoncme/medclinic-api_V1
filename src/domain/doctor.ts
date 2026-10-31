import type { NewUser, UserRole } from './user';
export interface NewDoctor {
  name: string;
  email: string;
  password: string;
  crm: string;
}
export interface Doctor {
  id: number;
  crm: string;
  user: { id: string; name: string; email: string; roles: UserRole[] };
}
export interface DoctorRegistration {
  crm: string;
  user: NewUser;
}
