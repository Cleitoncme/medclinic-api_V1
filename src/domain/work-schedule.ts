export interface Shift {
  weekDay: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}
export interface WorkSchedule {
  shifts: Shift[];
}
