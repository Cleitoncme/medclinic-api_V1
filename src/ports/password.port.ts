export const PASSWORD_SERVICE = Symbol('PASSWORD_SERVICE');

export interface PasswordPort {
  hash(password: string): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}
