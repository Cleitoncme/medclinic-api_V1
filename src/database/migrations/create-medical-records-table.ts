import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateMedicalRecordsTable1793275200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE medical_records (
    id SERIAL PRIMARY KEY,
    patient_id integer NOT NULL REFERENCES patients(id),
    doctor_id integer NOT NULL REFERENCES doctors(id),
    text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
    await runner.query(
      'CREATE INDEX "IDX_medical_records_patient_created" ON medical_records (patient_id, created_at DESC, id DESC)',
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE medical_records');
  }
}
