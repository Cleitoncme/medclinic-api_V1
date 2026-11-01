import type { AuthTokenPayload } from '../dtos/auth.dto';

export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface TokenIssuerPort {
  sign(payload: AuthTokenPayload): string;
}
