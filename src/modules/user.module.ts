import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserController } from '../controllers/user.controller';
import { DatabaseModule } from '../database/database.module';
import { User } from '../entities/user.entity';
import { RolesGuard } from '../guards/roles.guard';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { UserRepository } from '../repositories/user.repository';
import { PASSWORD_SERVICE, type PasswordPort } from '../ports/password.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../ports/user-repository.port';
import { UserService } from '../services/user.service';
import { SecurityModule } from './security.module';

@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [UserController],
  providers: [
    AuthenticationGuard,
    RolesGuard,
    {
      provide: USER_REPOSITORY,
      useFactory: (source: DataSource) => new UserRepository(source.getRepository(User)),
      inject: [DataSource],
    },
    {
      provide: UserService,
      useFactory: (repository: UserRepositoryPort, passwords: PasswordPort) =>
        new UserService(repository, passwords),
      inject: [USER_REPOSITORY, PASSWORD_SERVICE],
    },
  ],
  exports: [USER_REPOSITORY, UserService],
})
export class UserModule {}
