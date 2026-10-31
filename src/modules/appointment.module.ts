import { AppointmentQueryController } from '../controllers/appointment-query.controller';
import { AppointmentQueryService } from '../services/appointment-query.service';
import { AppointmentQueryRepository } from '../repositories/appointment-query.repository';
import { APPOINTMENT_QUERY, type AppointmentQueryPort } from '../ports/appointment-query.port';
import { AppointmentStatusService } from '../services/appointment-status.service';
import { AppointmentStatusRepository } from '../repositories/appointment-status.repository';
import {
  APPOINTMENT_STATUS_REPOSITORY,
  type AppointmentStatusPort,
} from '../ports/appointment-status.port';
import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from './security.module';
import { AppointmentController } from '../controllers/appointment.controller';
import { AppointmentRepository } from '../repositories/appointment.repository';
import {
  APPOINTMENT_REPOSITORY,
  type AppointmentRepositoryPort,
} from '../ports/appointment-repository.port';
import { AppointmentService } from '../services/appointment.service';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
@Module({
  imports: [DatabaseModule, SecurityModule],
  controllers: [AppointmentController, AppointmentQueryController],
  providers: [
    {
      provide: APPOINTMENT_QUERY,
      useFactory: (source: DataSource) => new AppointmentQueryRepository(source),
      inject: [DataSource],
    },
    {
      provide: AppointmentQueryService,
      useFactory: (repository: AppointmentQueryPort) => new AppointmentQueryService(repository),
      inject: [APPOINTMENT_QUERY],
    },
    {
      provide: APPOINTMENT_STATUS_REPOSITORY,
      useFactory: (source: DataSource) => new AppointmentStatusRepository(source),
      inject: [DataSource],
    },
    {
      provide: AppointmentStatusService,
      useFactory: (repository: AppointmentStatusPort) => new AppointmentStatusService(repository),
      inject: [APPOINTMENT_STATUS_REPOSITORY],
    },
    AuthenticationGuard,
    RolesGuard,
    {
      provide: APPOINTMENT_REPOSITORY,
      useFactory: (source: DataSource) => new AppointmentRepository(source),
      inject: [DataSource],
    },
    {
      provide: AppointmentService,
      useFactory: (repository: AppointmentRepositoryPort) => new AppointmentService(repository),
      inject: [APPOINTMENT_REPOSITORY],
    },
  ],
})
export class AppointmentModule {}
