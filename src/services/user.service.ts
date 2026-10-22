import type { CreateUserDTO, UserResponseDTO } from '../dtos/user.dto';
import { type PublicUser, UserRole } from '../domain/user';
import type { PasswordPort } from '../ports/password.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';
import { AppError } from '../utils/app-error';

export class UserService {
  public constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly passwords: PasswordPort,
  ) {}

  public async register(userData: CreateUserDTO): Promise<UserResponseDTO> {
    this.validateRegistrationInput(userData);

    const name = userData.name.trim();
    const email = userData.email.trim().toLowerCase();

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError(409, 'Email is already registered.');
    }

    const user = await this.userRepository.create({
      name,
      email,
      passwordHash: await this.passwords.hash(userData.password),
      role: UserRole.ATTENDANT,
    });

    return this.toResponseDTO(user);
  }

  public async getById(id: string): Promise<UserResponseDTO> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new AppError(404, 'Authenticated user was not found.');
    }

    return this.toResponseDTO(user);
  }

  private validateRegistrationInput(userData: CreateUserDTO): void {
    if (
      typeof userData !== 'object' ||
      userData === null ||
      Array.isArray(userData) ||
      typeof userData.name !== 'string' ||
      typeof userData.email !== 'string' ||
      typeof userData.password !== 'string'
    ) {
      throw new AppError(400, 'Name, email and password are required.');
    }

    const name = userData.name.trim();
    const email = userData.email.trim();

    if (!name || !email || !userData.password) {
      throw new AppError(400, 'Name, email and password are required.');
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new AppError(400, 'Email must have a valid format.');
    }

    if (userData.password.length < 8) {
      throw new AppError(400, 'Password must contain at least 8 characters.');
    }
  }

  private toResponseDTO(user: PublicUser): UserResponseDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
