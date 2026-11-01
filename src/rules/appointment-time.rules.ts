import { DomainError } from '../domain/domain-error';
import type { Shift } from '../domain/work-schedule';
export function parseAppointmentInstant(value: unknown): Date {
  const invalid = (): never => {
    throw new DomainError(
      'DADOS_INVALIDOS',
      'startsAt deve ser uma data ISO valida com fuso horario explicito.',
    );
  };
  if (typeof value !== 'string') invalid();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.exec(
      value as string,
    );
  if (!match) return invalid();
  const nominal = new Date((value as string).replace(/(Z|[+-]\d{2}:\d{2})$/, 'Z'));
  if (
    !Number.isFinite(nominal.getTime()) ||
    nominal.getUTCFullYear() !== Number(match[1]) ||
    nominal.getUTCMonth() + 1 !== Number(match[2]) ||
    nominal.getUTCDate() !== Number(match[3])
  )
    invalid();
  const instant = new Date(value as string);
  if (!Number.isFinite(instant.getTime())) invalid();
  return instant;
}
const localClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
function localParts(date: Date) {
  const parts = Object.fromEntries(
    localClock.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    day: [parts.year, parts.month, parts.day].join('-'),
    weekDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday!),
    millis:
      (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 +
      date.getUTCMilliseconds(),
  };
}
const clockMillis = (value: string): number =>
  (Number(value.slice(0, 2)) * 60 + Number(value.slice(3))) * 60000;
export function appointmentEnd(startsAt: Date, shifts: Shift[]): Date {
  const outside = (): never => {
    throw new DomainError('HORARIO_FORA_DA_ESCALA', 'Horario fora da escala do medico.');
  };
  const local = localParts(startsAt);
  const shift = shifts.find(
    (s) =>
      s.weekDay === local.weekDay &&
      local.millis >= clockMillis(s.startTime) &&
      local.millis < clockMillis(s.endTime),
  );
  if (!shift) return outside();
  const duration = shift.slotDurationMinutes * 60000;
  if (
    (local.millis - clockMillis(shift.startTime)) % duration !== 0 ||
    local.millis + duration > clockMillis(shift.endTime)
  )
    outside();
  const end = new Date(startsAt.getTime() + duration);
  const localEnd = localParts(end);
  if (localEnd.day !== local.day || localEnd.millis > clockMillis(shift.endTime)) outside();
  return end;
}
export function periodsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
