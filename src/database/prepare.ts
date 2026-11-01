import { appDataSource } from './data-source';
import { seedAdmin } from './seed-admin';

async function prepare(): Promise<void> {
  const seed = process.env.SEED_ADMIN_ON_START ?? 'false';
  if (seed !== 'true' && seed !== 'false')
    throw new Error('SEED_ADMIN_ON_START deve ser true ou false.');
  await appDataSource.initialize();
  const runner = appDataSource.createQueryRunner();
  try {
    // All revisions use the same PostgreSQL session lock while preparing the schema and seed.
    await runner.query('SELECT pg_advisory_lock($1)', [1726000000]);
    try {
      await appDataSource.runMigrations({ transaction: 'all' });
      if (seed === 'true') await seedAdmin(appDataSource);
    } finally {
      await runner.query('SELECT pg_advisory_unlock($1)', [1726000000]);
    }
  } finally {
    await runner.release();
    await appDataSource.destroy();
  }
}

void prepare().catch((error: unknown) => {
  console.error(
    'Falha ao preparar banco.',
    error instanceof Error ? error.message : 'Erro inesperado.',
  );
  process.exitCode = 1;
});
