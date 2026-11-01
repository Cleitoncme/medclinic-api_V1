import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthTokenPayload } from '../dtos/auth.dto';
import type { TokenIssuerPort } from '../ports/token-issuer.port';

interface JwtOptions {
  secret: string;
  expiresIn: string;
}

export class JwtTokenAdapter implements TokenIssuerPort {
  public constructor(private readonly options: JwtOptions) {}

  public sign(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.options.secret, {
      expiresIn: this.options.expiresIn as SignOptions['expiresIn'],
    });
  }
}
