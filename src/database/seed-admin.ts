import 'dotenv/config';
import type { DataSource } from 'typeorm';
import { appDataSource } from './data-source';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { BcryptPasswordAdapter } from '../adapters/bcrypt-password.adapter';
import { UserService } from '../services/user.service';
export async function seedAdmin(source: DataSource = appDataSource): Promise<void> {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password)
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD.');
  const ownsConnection = !source.isInitialized;
  if (ownsConnection) await source.initialize();
  try {
    const service = new UserService(
      new UserRepository(source.getRepository(User)),
      new BcryptPasswordAdapter(),
    );
    const created = await service.ensureAdmin({ name, email, password });
    console.log(
      created ? 'Administrador criado.' : 'Administrador já existe; credenciais preservadas.',
    );
  } finally {
    if (ownsConnection) await source.destroy();
  }
}
if (require.main === module)
  void seedAdmin().catch((error: unknown) => {
    console.error(
      'Falha no seed administrativo.',
      error instanceof Error ? error.message : 'Erro inesperado.',
    );
    process.exitCode = 1;
  });
