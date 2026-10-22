import { Module } from '@nestjs/common';
import { BcryptPasswordAdapter } from '../adapters/bcrypt-password.adapter';
import { JwtTokenAdapter } from '../adapters/jwt-token.adapter';
import { env } from '../config/env';
import { PASSWORD_SERVICE } from '../ports/password.port';
import { TOKEN_ISSUER } from '../ports/token-issuer.port';

@Module({
  providers: [
    { provide: PASSWORD_SERVICE, useClass: BcryptPasswordAdapter },
    { provide: TOKEN_ISSUER, useFactory: () => new JwtTokenAdapter(env.jwt) },
  ],
  exports: [PASSWORD_SERVICE, TOKEN_ISSUER],
})
export class SecurityModule {}
