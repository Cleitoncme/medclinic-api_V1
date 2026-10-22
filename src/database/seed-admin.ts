import 'dotenv/config';

import { appDataSource } from './data-source';
import { User, UserRole } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { hashPassword } from '../utils/password';

function getAdminInput(): { name: string; email: string; password: string } {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must have a valid format.');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
  }

  return { name, email, password };
}

async function seedAdmin(): Promise<void> {
  const admin = getAdminInput();

  await appDataSource.initialize();

  try {
    const userRepository = new UserRepository(appDataSource.getRepository(User));
    const existingUser = await userRepository.findByEmail(admin.email);

    if (existingUser) {
      console.log('An account with ADMIN_EMAIL already exists.');
      return;
    }

    await userRepository.create({
      name: admin.name,
      email: admin.email,
      passwordHash: await hashPassword(admin.password),
      role: UserRole.ADMIN,
    });

    console.log('Administrator account created.');
  } finally {
    await appDataSource.destroy();
  }
}

void seedAdmin().catch((error: unknown) => {
  console.error('Unable to create the administrator account.', error);
  process.exitCode = 1;
});
