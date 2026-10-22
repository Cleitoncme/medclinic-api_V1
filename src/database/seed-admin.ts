import 'dotenv/config';
import { appDataSource } from './data-source';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { BcryptPasswordAdapter } from '../adapters/bcrypt-password.adapter';
import { UserService } from '../services/user.service';
async function seedAdmin(): Promise<void> {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password)
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD.');
  await appDataSource.initialize();
  try {
    const service = new UserService(
      new UserRepository(appDataSource.getRepository(User)),
      new BcryptPasswordAdapter(),
    );
    const created = await service.ensureAdmin({ name, email, password });
    console.log(
      created ? 'Administrador criado.' : 'Administrador já existe; credenciais preservadas.',
    );
  } finally {
    await appDataSource.destroy();
  }
}
void seedAdmin().catch((error: unknown) => {
  console.error(
    'Falha no seed administrativo.',
    error instanceof Error ? error.message : 'Erro inesperado.',
  );
  process.exitCode = 1;
});
