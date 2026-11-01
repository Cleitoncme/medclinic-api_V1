import type { Patient, NewPatient } from '../domain/patient';
import type { Pagination } from '../rules/pagination.rules';

export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');
export interface PatientSearch extends Pagination {
  name?: string;
}
export interface PatientRepositoryPort {
  create(input: NewPatient): Promise<Patient>;
  // CPF stays reserved even after logical deletion.
  findByCpf(cpf: string): Promise<Patient | null>;
  findById(id: number): Promise<Patient | null>;
  list(search: PatientSearch): Promise<{ data: Patient[]; total: number }>;
  updateName(id: number, name: string): Promise<Patient | null>;
  remove(id: number): Promise<boolean>;
}
