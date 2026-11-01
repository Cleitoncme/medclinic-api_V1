import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientsTable1792785600000 implements MigrationInterface {
  name = 'CreatePatientsTable1792785600000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "patients" (
      "id" SERIAL PRIMARY KEY,
      "name" varchar(120) NOT NULL,
      "cpf" varchar(11) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "deleted_at" timestamptz,
      CONSTRAINT "UQ_patients_cpf" UNIQUE ("cpf"),
      CONSTRAINT "CHK_patients_cpf" CHECK ("cpf" ~ '^[0-9]{11}$'),
      CONSTRAINT "CHK_patients_name" CHECK (length(btrim("name")) > 0)
    )`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE "patients"');
  }
}
