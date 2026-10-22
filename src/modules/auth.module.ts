import { Module } from '@nestjs/common';
import { AuthController } from '../controllers/auth.controller';
import { PASSWORD_SERVICE, type PasswordPort } from '../ports/password.port';
import { TOKEN_ISSUER, type TokenIssuerPort } from '../ports/token-issuer.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../ports/user-repository.port';
import { AuthService } from '../services/auth.service';
import { SecurityModule } from './security.module';
import { UserModule } from './user.module';

@Module({
  imports: [UserModule, SecurityModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: (
        repository: UserRepositoryPort,
        passwords: PasswordPort,
        tokens: TokenIssuerPort,
      ) => new AuthService(repository, passwords, tokens),
      inject: [USER_REPOSITORY, PASSWORD_SERVICE, TOKEN_ISSUER],
    },
  ],
})
export class AuthModule {}
