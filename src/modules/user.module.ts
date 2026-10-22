import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserController } from '../controllers/user.controller';
import { DatabaseModule } from '../database/database.module';
import { User } from '../entities/user.entity';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [
    AuthenticationGuard,
    {
      provide: UserRepository,
      useFactory: (source: DataSource) => new UserRepository(source.getRepository(User)),
      inject: [DataSource],
    },
    {
      provide: UserService,
      useFactory: (repository: UserRepository) => new UserService(repository),
      inject: [UserRepository],
    },
  ],
  exports: [UserRepository, UserService],
})
export class UserModule {}
