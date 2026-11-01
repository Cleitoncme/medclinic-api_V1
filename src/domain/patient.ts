export interface Patient {
  id: number;
  name: string;
  cpf: string;
  createdAt: Date;
}
export interface NewPatient {
  name: string;
  cpf: string;
}
