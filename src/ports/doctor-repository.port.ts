import type { Doctor, DoctorRegistration } from '../domain/doctor';
import type { Pagination } from '../rules/pagination.rules';
export const DOCTOR_REPOSITORY = Symbol('DOCTOR_REPOSITORY');
export interface DoctorRepositoryPort {
  createWithUser(input: DoctorRegistration): Promise<Doctor>;
  findById(id: number): Promise<Doctor | null>;
  list(query: Pagination & { name?: string }): Promise<{ data: Doctor[]; total: number }>;
}
