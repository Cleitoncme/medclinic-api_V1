export interface MedicalRecord {
  id: number;
  patientId: number;
  doctorId: number;
  text: string;
  createdAt: Date;
}
