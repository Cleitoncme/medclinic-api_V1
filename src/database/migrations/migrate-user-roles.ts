import type { MigrationInterface, QueryRunner } from 'typeorm';
export class MigrateUserRoles1792670400000 implements MigrationInterface {
  name = 'MigrateUserRoles1792670400000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query("CREATE TYPE users_roles_enum AS ENUM ('admin', 'secretary', 'doctor')");
    await runner.query('ALTER TABLE users ADD COLUMN roles users_roles_enum[]');
    await runner.query(
      "UPDATE users SET roles = ARRAY[CASE WHEN role::text = 'ADMIN' THEN 'admin' ELSE 'secretary' END]::users_roles_enum[]",
    );
    await runner.query('ALTER TABLE users ALTER COLUMN roles SET NOT NULL');
    await runner.query(
      'ALTER TABLE users ADD CONSTRAINT CHK_users_roles_nonempty CHECK (cardinality(roles) > 0)',
    );
    await runner.query('ALTER TABLE users DROP COLUMN role');
    await runner.query('DROP TYPE public.users_role_enum');
  }
  async down(runner: QueryRunner): Promise<void> {
    // Reject lossy rollback for doctor or multiple roles.
    await runner.query(
      "DO $$ BEGIN IF EXISTS (SELECT 1 FROM users WHERE cardinality(roles) <> 1 OR 'doctor'::users_roles_enum = ANY(roles)) THEN RAISE EXCEPTION 'Rollback perderia perfis; migre os dados explicitamente.'; END IF; END $$",
    );
    await runner.query("CREATE TYPE public.users_role_enum AS ENUM ('ADMIN', 'ATTENDANT')");
    await runner.query(
      "ALTER TABLE users ADD COLUMN role public.users_role_enum NOT NULL DEFAULT 'ATTENDANT'",
    );
    await runner.query(
      "UPDATE users SET role = 'ADMIN' WHERE 'admin'::users_roles_enum = ANY(roles)",
    );
    await runner.query('ALTER TABLE users DROP COLUMN roles');
    await runner.query('DROP TYPE users_roles_enum');
  }
}
