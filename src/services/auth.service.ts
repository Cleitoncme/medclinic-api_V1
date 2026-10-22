import type { AuthTokenPayload, LoginDTO, LoginResponseDTO } from '../dtos/auth.dto';
import type { PasswordPort } from '../ports/password.port';
import type { TokenIssuerPort } from '../ports/token-issuer.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { AppError } from '../utils/app-error';

export class AuthService {
  public constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwords: PasswordPort,
    private readonly tokens: TokenIssuerPort,
  ) {}

  public async login(credentials: LoginDTO): Promise<LoginResponseDTO> {
    this.validateLoginInput(credentials);

    const email = credentials.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmailWithPassword(email);

    if (!user || !(await this.passwords.compare(credentials.password, user.passwordHash))) {
      throw new AppError(401, 'Invalid credentials.');
    }

    const payload: AuthTokenPayload = { id: user.id, role: user.role };
    return { token: this.tokens.sign(payload) };
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
