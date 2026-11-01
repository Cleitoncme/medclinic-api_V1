import type { CreateUserDTO, UserResponseDTO } from '../dtos/user.dto';
import { type PublicUser, UserRole } from '../domain/user';
import { isRoles } from '../rules/user-roles.rules';
import type { PasswordPort } from '../ports/password.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { DomainError } from '../domain/domain-error';
export class UserService {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwords: PasswordPort,
  ) {}
  async create(input: CreateUserDTO): Promise<UserResponseDTO> {
    this.validate(input);
    const email = input.email.trim().toLowerCase();
    if (await this.userRepository.findByEmail(email))
      throw new DomainError('EMAIL_JA_CADASTRADO', 'E-mail já cadastrado.');
    return this.toResponse(
      await this.userRepository.create({
        name: input.name.trim(),
        email,
        passwordHash: await this.passwords.hash(input.password),
        roles: [...new Set(input.roles)],
      }),
    );
  }
  async getById(id: string): Promise<UserResponseDTO> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Usuário não encontrado.');
    return this.toResponse(user);
  }
  async ensureAdmin(input: Omit<CreateUserDTO, 'roles'>): Promise<boolean> {
    const admin = { ...input, roles: [UserRole.ADMIN] };
    this.validate(admin);
    const existing = await this.userRepository.findByEmail(admin.email.trim().toLowerCase());
    if (existing) {
      if (!existing.roles.includes(UserRole.ADMIN))
        throw new DomainError(
          'ACESSO_NEGADO',
          'O e-mail do seed pertence a um usuário sem perfil admin. Nenhum privilégio foi alterado.',
        );
      return false;
    }
    await this.create(admin);
    return true;
  }
  private validate(input: CreateUserDTO): void {
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      typeof input.name !== 'string' ||
      typeof input.email !== 'string' ||
      typeof input.password !== 'string' ||
      !input.name.trim() ||
      !input.email.trim() ||
      !input.password
    )
      throw new DomainError('DADOS_INVALIDOS', 'Nome, e-mail e senha são obrigatórios.');
    if (
      input.name.trim().length > 120 ||
      input.email.trim().length > 160 ||
      !/^\S+@\S+\.\S+$/.test(input.email.trim())
    )
      throw new DomainError('DADOS_INVALIDOS', 'Nome ou e-mail inválido.');
    if (input.password.length < 8 || !isRoles(input.roles))
      throw new DomainError(
        'DADOS_INVALIDOS',
        'Senha deve ter ao menos oito caracteres e roles deve conter perfis válidos.',
      );
  }
  private toResponse(user: PublicUser): UserResponseDTO {
    return { id: user.id, name: user.name, email: user.email, roles: [...user.roles] };
  }
}
