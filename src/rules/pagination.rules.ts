import { DomainError } from '../domain/domain-error';

export interface Pagination {
  page: number;
  pageSize: number;
}
export function parsePagination(query: Record<string, unknown>): Pagination {
  function positiveInteger(value: unknown, fallback: number, maximum: number): number {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
      throw new DomainError('DADOS_INVALIDOS', 'Paginação inválida.');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > maximum)
      throw new DomainError('DADOS_INVALIDOS', 'Paginação inválida.');
    return parsed;
  }
  return {
    page: positiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: positiveInteger(query.pageSize, 20, 100),
  };
}
export function paginated<T>(data: T[], total: number, pagination: Pagination) {
  return {
    data,
    meta: { total, ...pagination, totalPages: Math.ceil(total / pagination.pageSize) },
  };
}
