import { describe, expect, it } from 'vitest';
import { parsePagination, paginated } from '../../src/rules/pagination.rules';
describe('paginação para os próximos módulos', () => {
  it('aplica padrões e aceita limite 100', () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 });
    expect(parsePagination({ page: '2', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 });
  });
  it.each(['0', '-1', '1.5', 'abc', '', null, [], {}, 1, '9007199254740992'])(
    'rejeita página inválida %j',
    (page) => {
      expect(() => parsePagination({ page })).toThrow(
        expect.objectContaining({ code: 'DADOS_INVALIDOS' }),
      );
    },
  );
  it('rejeita pageSize maior que 100', () => {
    expect(() => parsePagination({ pageSize: '101' })).toThrow(
      expect.objectContaining({ code: 'DADOS_INVALIDOS' }),
    );
  });
  it('monta envelope com arredondamento e resultado vazio', () => {
    expect(paginated(['item'], 21, { page: 2, pageSize: 20 })).toEqual({
      data: ['item'],
      meta: { total: 21, page: 2, pageSize: 20, totalPages: 2 },
    });
    expect(paginated([], 0, { page: 1, pageSize: 20 }).meta.totalPages).toBe(0);
  });
});
