import { UserRole } from '../domain/user';
import { DomainError } from '../domain/domain-error';
import type { MedicalRecord } from '../domain/medical-record';
import type { Actor } from '../ports/appointment-status.port';
import type { MedicalRecordPort } from '../ports/medical-record.port';
import { paginated, parsePagination } from '../rules/pagination.rules';
export class MedicalRecordService {
  constructor(private readonly repository: MedicalRecordPort) {}
  private id(raw: string): number {
    if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 2147483647)
      throw new DomainError('DADOS_INVALIDOS', 'Identificador invalido.');
    return Number(raw);
  }
  private response(record: MedicalRecord) {
    return {
      id: record.id,
      patientId: record.patientId,
      doctorId: record.doctorId,
      text: record.text,
      createdAt: record.createdAt.toISOString(),
    };
  }
  private async patient(id: number) {
    if (!(await this.repository.patientExists(id)))
      throw new DomainError('RECURSO_NAO_ENCONTRADO', 'Paciente nao encontrado.');
  }
  private denied(): never {
    throw new DomainError('ACESSO_NEGADO', 'Acesso ao prontuario negado.');
  }
  async create(rawId: string, actor: Actor, input: unknown) {
    const patientId = this.id(rawId);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      typeof (input as { text?: unknown }).text !== 'string' ||
      !(input as { text: string }).text.trim()
    )
      throw new DomainError('DADOS_INVALIDOS', 'Texto obrigatorio.');
    const text = (input as { text: string }).text.trim();
    if (!actor.roles.includes(UserRole.DOCTOR)) this.denied();
    await this.patient(patientId);
    const doctorId = await this.repository.linkedDoctorId(patientId, actor.id);
    if (doctorId === null) this.denied();
    return this.response(await this.repository.create(patientId, doctorId, text));
  }
  async list(rawId: string, actor: Actor, query: Record<string, unknown>) {
    const patientId = this.id(rawId);
    const pagination = parsePagination(query);
    if (!Number.isSafeInteger((pagination.page - 1) * pagination.pageSize))
      throw new DomainError('DADOS_INVALIDOS', 'Paginacao invalida.');
    if (!actor.roles.includes(UserRole.ADMIN) && !actor.roles.includes(UserRole.DOCTOR))
      this.denied();
    await this.patient(patientId);
    if (
      !actor.roles.includes(UserRole.ADMIN) &&
      (await this.repository.linkedDoctorId(patientId, actor.id)) === null
    )
      this.denied();
    const result = await this.repository.list(patientId, pagination);
    return paginated(
      result.data.map((record) => this.response(record)),
      result.total,
      pagination,
    );
  }
}
