import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { PatientEntity } from '../entities/patient.entity';
import { PatientController } from '../controllers/patient.controller';
import { PatientRepository } from '../repositories/patient.repository';
import { PATIENT_REPOSITORY, type PatientRepositoryPort } from '../ports/patient-repository.port';
import { PatientService } from '../services/patient.service';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [PatientController],
  providers: [
    AuthenticationGuard,
    RolesGuard,
    {
      provide: PATIENT_REPOSITORY,
      useFactory: (source: DataSource) =>
        new PatientRepository(source.getRepository(PatientEntity)),
      inject: [DataSource],
    },
    {
      provide: PatientService,
      useFactory: (repository: PatientRepositoryPort) => new PatientService(repository),
      inject: [PATIENT_REPOSITORY],
    },
  ],
  exports: [PatientService, PATIENT_REPOSITORY],
})
export class PatientModule {}
