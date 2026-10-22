import { Module } from '@nestjs/common';
import { AuthController } from '../controllers/auth.controller';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { UserModule } from './user.module';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useFactory: (repository: UserRepository) => new AuthService(repository),
      inject: [UserRepository],
    },
  ],
})
export class AuthModule {}
