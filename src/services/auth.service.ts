import jwt, { type SignOptions } from 'jsonwebtoken';

import type { AuthTokenPayload, LoginDTO, LoginResponseDTO } from '../dtos/auth.dto';
import { env } from '../config/env';
import { UserRepository } from '../repositories/user.repository';
import { comparePassword } from '../utils/password';
import { AppError } from '../utils/app-error';

export class AuthService {
  public constructor(private readonly userRepository: UserRepository) {}

  public async login(credentials: LoginDTO): Promise<LoginResponseDTO> {
    this.validateLoginInput(credentials);

    const email = credentials.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmailWithPassword(email);

    if (!user || !(await comparePassword(credentials.password, user.passwordHash))) {
      throw new AppError(401, 'Invalid credentials.');
    }

    const payload: AuthTokenPayload = { id: user.id, role: user.role };
    const options: SignOptions = { expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'] };

    return { token: jwt.sign(payload, env.jwt.secret, options) };
  }

  private validateLoginInput(credentials: LoginDTO): void {
    if (
      typeof credentials !== 'object' ||
      credentials === null ||
      Array.isArray(credentials) ||
      typeof credentials.email !== 'string' ||
      typeof credentials.password !== 'string' ||
      !credentials.email.trim() ||
      !credentials.password
    ) {
      throw new AppError(400, 'Email and password are required.');
    }
  }
}
