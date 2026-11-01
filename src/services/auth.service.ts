import type { AuthTokenPayload, LoginDTO, LoginResponseDTO } from '../dtos/auth.dto';
import type { PasswordPort } from '../ports/password.port';
import type { TokenIssuerPort } from '../ports/token-issuer.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { DomainError } from '../domain/domain-error';
export class AuthService {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwords: PasswordPort,
    private readonly tokens: TokenIssuerPort,
  ) {}
  async login(credentials: LoginDTO): Promise<LoginResponseDTO> {
    if (
      typeof credentials !== 'object' ||
      credentials === null ||
      Array.isArray(credentials) ||
      typeof credentials.email !== 'string' ||
      typeof credentials.password !== 'string' ||
      !credentials.email.trim() ||
      !credentials.password
    ) {
      throw new DomainError('DADOS_INVALIDOS', 'E-mail e senha são obrigatórios.');
    }
    const user = await this.userRepository.findByEmailWithPassword(
      credentials.email.trim().toLowerCase(),
    );
    if (!user || !(await this.passwords.compare(credentials.password, user.passwordHash))) {
      throw new DomainError('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    }
    const payload: AuthTokenPayload = { id: user.id, roles: user.roles };
    return { accessToken: this.tokens.sign(payload) };
  }
}
