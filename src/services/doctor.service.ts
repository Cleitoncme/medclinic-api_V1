import type { Doctor, NewDoctor } from '../domain/doctor';
import { DomainError } from '../domain/domain-error';
import { UserRole } from '../domain/user';
import type { DoctorRepositoryPort } from '../ports/doctor-repository.port';
import type { PasswordPort } from '../ports/password.port';
import { paginated, parsePagination } from '../rules/pagination.rules';
export class DoctorService {
  constructor(
    private readonly repository: DoctorRepositoryPort,
    private readonly passwords: PasswordPort,
  ) {}
  async create(input: NewDoctor): Promise<Doctor> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) this.invalid();
    if (
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 120 ||
      typeof input.email !== 'string' ||
      input.email.trim().length > 160 ||
      !/^\S+@\S+\.\S+$/.test(input.email.trim()) ||
      typeof input.password !== 'string' ||
      input.password.length < 8 ||
      typeof input.crm !== 'string' ||
      !input.crm.trim() ||
      input.crm.trim().length > 50
    )
      this.invalid();
    const doctor = await this.repository.createWithUser({
      crm: input.crm.trim(),
      user: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        passwordHash: await this.passwords.hash(input.password),
        roles: [UserRole.DOCTOR],
      },
    });
    return this.response(doctor);
  }
  async getById(rawId: string): Promise<Doctor> {
    if (!/^[1-9]\d*$/.test(rawId)) this.invalid();
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id > 2147483647) this.invalid();
    const doctor = await this.repository.findById(id);
    if (!doctor) throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Medico nao encontrado.');
    return this.response(doctor);
  }
  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    if (!Number.isSafeInteger((pagination.page - 1) * pagination.pageSize)) this.invalid();
    if (query.name !== undefined && typeof query.name !== 'string') this.invalid();
    const name = typeof query.name === 'string' ? query.name.trim() : undefined;
    const result = await this.repository.list({ ...pagination, ...(name ? { name } : {}) });
    return paginated(
      result.data.map((doctor) => this.response(doctor)),
      result.total,
      pagination,
    );
  }
  private response(doctor: Doctor): Doctor {
    return {
      id: doctor.id,
      crm: doctor.crm,
      user: {
        id: doctor.user.id,
        name: doctor.user.name,
        email: doctor.user.email,
        roles: [...doctor.user.roles],
      },
    };
  }
  private invalid(): never {
    throw new DomainError(
      'DADOS_INVALIDOS',
      'Dados do medico, identificador ou filtros invalidos.',
    );
  }
}
