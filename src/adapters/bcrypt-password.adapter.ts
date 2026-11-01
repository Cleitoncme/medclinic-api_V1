import type { PasswordPort } from '../ports/password.port';
import { comparePassword, hashPassword } from '../utils/password';

export class BcryptPasswordAdapter implements PasswordPort {
  public hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  public compare(password: string, passwordHash: string): Promise<boolean> {
    return comparePassword(password, passwordHash);
  }
}
