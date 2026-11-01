import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateAppointmentsTable1793188800000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE appointments (
      id SERIAL PRIMARY KEY,
      doctor_id integer NOT NULL REFERENCES doctors(id),
      patient_id integer NOT NULL REFERENCES patients(id),
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'scheduled',
      CONSTRAINT "CK_appointments_period" CHECK (starts_at < ends_at),
      CONSTRAINT "CK_appointments_status" CHECK (status IN ('scheduled','in_progress','done','cancelled'))
    )`);
    await runner.query(
      `CREATE INDEX "IDX_appointments_doctor_period" ON appointments (doctor_id,starts_at,ends_at) WHERE status <> 'cancelled'`,
    );
    await runner.query(
      `CREATE INDEX "IDX_appointments_patient_period" ON appointments (patient_id,starts_at,ends_at) WHERE status <> 'cancelled'`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE appointments');
  }
}
