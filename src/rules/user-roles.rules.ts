import { UserRole } from '../domain/user';
export function isRoles(value: unknown): value is UserRole[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((role: unknown) => Object.values(UserRole).includes(role as UserRole))
  );
}
