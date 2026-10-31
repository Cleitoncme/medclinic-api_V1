import type { MedicalRecord } from '../domain/medical-record';
import type { Pagination } from '../rules/pagination.rules';
export const MEDICAL_RECORD_REPOSITORY = Symbol('MEDICAL_RECORD_REPOSITORY');
export interface MedicalRecordPort {
  patientExists(id: number): Promise<boolean>;
  linkedDoctorId(patientId: number, userId: string): Promise<number | null>;
  create(patientId: number, doctorId: number, text: string): Promise<MedicalRecord>;
  list(
    patientId: number,
    pagination: Pagination,
  ): Promise<{ data: MedicalRecord[]; total: number }>;
}
