export type ErrorCode =
  | 'DADOS_INVALIDOS'
  | 'NAO_AUTENTICADO'
  | 'CREDENCIAIS_INVALIDAS'
  | 'ACESSO_NEGADO'
  | 'RECURSO_NAO_ENCONTRADO'
  | 'EMAIL_JA_CADASTRADO'
  | 'CPF_JA_CADASTRADO';
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
