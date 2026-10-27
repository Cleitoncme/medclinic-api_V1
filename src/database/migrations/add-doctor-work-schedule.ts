import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddDoctorWorkSchedule1793102400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE doctors ADD COLUMN shifts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(shifts) = 'array')`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE doctors DROP COLUMN shifts');
  }
}
