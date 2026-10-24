import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from './security.module';
import { DoctorController } from '../controllers/doctor.controller';
import { DoctorRepository } from '../repositories/doctor.repository';
import { DOCTOR_REPOSITORY, type DoctorRepositoryPort } from '../ports/doctor-repository.port';
import { PASSWORD_SERVICE, type PasswordPort } from '../ports/password.port';
import { DoctorService } from '../services/doctor.service';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [DoctorController],
  providers: [
    AuthenticationGuard,
    RolesGuard,
    {
      provide: DOCTOR_REPOSITORY,
      useFactory: (source: DataSource) => new DoctorRepository(source),
      inject: [DataSource],
    },
    {
      provide: DoctorService,
      useFactory: (repository: DoctorRepositoryPort, passwords: PasswordPort) =>
        new DoctorService(repository, passwords),
      inject: [DOCTOR_REPOSITORY, PASSWORD_SERVICE],
    },
  ],
  exports: [DoctorService, DOCTOR_REPOSITORY],
})
export class DoctorModule {}
