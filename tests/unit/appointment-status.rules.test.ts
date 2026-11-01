import { describe, expect, it } from 'vitest';
import {
  parseAppointmentStatus,
  validateStatusTransition,
} from '../../src/rules/appointment-status.rules';
import { UserRole } from '../../src/domain/user';
describe('transicoes de agendamento', () => {
  it.each(['scheduled', 'in_progress', 'done', 'cancelled'] as const)(
    'aceita status %s',
    (status) => expect(parseAppointmentStatus(status)).toBe(status),
  );
  it.each([null, undefined, '', 'DONE', 1])('rejeita status invalido %#', (value) =>
    expect(() => parseAppointmentStatus(value)).toThrow(
      expect.objectContaining({ code: 'DADOS_INVALIDOS' }),
    ),
  );
  it.each([
    ['scheduled', 'in_progress'],
    ['scheduled', 'cancelled'],
    ['in_progress', 'done'],
    ['in_progress', 'cancelled'],
  ] as const)('permite admin ou medico responsavel de %s para %s', (from, to) => {
    expect(() => validateStatusTransition(from, to, [UserRole.ADMIN], false)).not.toThrow();
    expect(() => validateStatusTransition(from, to, [UserRole.DOCTOR], true)).not.toThrow();
    expect(() => validateStatusTransition(from, to, [UserRole.DOCTOR], false)).toThrow(
      expect.objectContaining({ code: 'ACESSO_NEGADO' }),
    );
  });
  it('permite secretaria cancelar agendada, mas nao em andamento', () => {
    expect(() =>
      validateStatusTransition('scheduled', 'cancelled', [UserRole.SECRETARY], false),
    ).not.toThrow();
    expect(() =>
      validateStatusTransition('in_progress', 'cancelled', [UserRole.SECRETARY], false),
    ).toThrow(expect.objectContaining({ code: 'ACESSO_NEGADO' }));
  });
  it.each([
    ['scheduled', 'done'],
    ['done', 'cancelled'],
    ['cancelled', 'scheduled'],
    ['in_progress', 'in_progress'],
  ] as const)('recusa transicao invalida %s para %s', (from, to) =>
    expect(() => validateStatusTransition(from, to, [UserRole.ADMIN], true)).toThrow(
      expect.objectContaining({ code: 'TRANSICAO_INVALIDA' }),
    ),
  );
});
