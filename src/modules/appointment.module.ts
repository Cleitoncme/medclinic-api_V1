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
  controllers: [AppointmentController],
  providers: [
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
