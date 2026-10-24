import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateDoctorsTable1792872000000 implements MigrationInterface {
  name = 'CreateDoctorsTable1792872000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE doctors (
      id SERIAL PRIMARY KEY,
      crm varchar(50) NOT NULL,
      user_id uuid NOT NULL,
      CONSTRAINT "UQ_doctors_crm" UNIQUE (crm),
      CONSTRAINT "UQ_doctors_user_id" UNIQUE (user_id),
      CONSTRAINT "FK_doctors_user" FOREIGN KEY (user_id) REFERENCES users(id),
      CONSTRAINT "CK_doctors_crm" CHECK (length(trim(crm)) > 0)
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE doctors');
  }
}
