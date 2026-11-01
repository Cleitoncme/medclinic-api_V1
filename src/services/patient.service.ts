import type { NewPatient, Patient } from '../domain/patient';
import { DomainError } from '../domain/domain-error';
import type { PatientRepositoryPort } from '../ports/patient-repository.port';
import { paginated, parsePagination } from '../rules/pagination.rules';

export class PatientService {
  constructor(private readonly repository: PatientRepositoryPort) {}

  async create(input: NewPatient): Promise<Patient> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) this.invalid();
    const name = this.name(input.name);
    if (typeof input.cpf !== 'string' || !/^\d{11}$/.test(input.cpf)) this.invalid();
    if (await this.repository.findByCpf(input.cpf)) {
      throw new DomainError('CPF_JA_CADASTRADO', 'CPF já cadastrado.');
    }
    return this.response(await this.repository.create({ name, cpf: input.cpf }));
  }

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    if (!Number.isSafeInteger((pagination.page - 1) * pagination.pageSize)) this.invalid();
    if (query.name !== undefined && typeof query.name !== 'string') this.invalid();
    const name = typeof query.name === 'string' ? query.name.trim() : undefined;
    const result = await this.repository.list({ ...pagination, ...(name ? { name } : {}) });
    return paginated(
      result.data.map((patient) => this.response(patient)),
      result.total,
      pagination,
    );
  }

  async getById(rawId: string): Promise<Patient> {
    const patient = await this.repository.findById(this.id(rawId));
    if (!patient) this.notFound();
    return this.response(patient);
  }

  async update(rawId: string, input: { name: string }): Promise<Patient> {
    const id = this.id(rawId);
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'name')
    )
      this.invalid();
    const patient = await this.repository.updateName(id, this.name(input.name));
    if (!patient) this.notFound();
    return this.response(patient);
  }

  async remove(rawId: string): Promise<void> {
    if (!(await this.repository.remove(this.id(rawId)))) this.notFound();
  }

  private id(value: string): number {
    if (!/^[1-9]\d*$/.test(value)) this.invalid();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > 2147483647) this.invalid();
    return parsed;
  }
  private name(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) this.invalid();
    return value.trim();
  }
  private response(patient: Patient): Patient {
    return { id: patient.id, name: patient.name, cpf: patient.cpf, createdAt: patient.createdAt };
  }
  private invalid(): never {
    throw new DomainError(
      'DADOS_INVALIDOS',
      'Dados do paciente, identificador ou filtros inválidos.',
    );
  }
  private notFound(): never {
    throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Paciente não encontrado.');
  }
}
