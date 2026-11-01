import type { Shift } from '../domain/work-schedule';
export const WORK_SCHEDULE_REPOSITORY = Symbol('WORK_SCHEDULE_REPOSITORY');
export interface WorkScheduleRepositoryPort {
  find(doctorId: number): Promise<Shift[] | null>;
  replace(doctorId: number, shifts: Shift[]): Promise<boolean>;
}
