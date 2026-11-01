import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { MedicalRecordController } from '../controllers/medical-record.controller';
import { MedicalRecordService } from '../services/medical-record.service';
import { MedicalRecordRepository } from '../repositories/medical-record.repository';
import { MEDICAL_RECORD_REPOSITORY, type MedicalRecordPort } from '../ports/medical-record.port';
@Module({
  imports: [DatabaseModule],
  controllers: [MedicalRecordController],
  providers: [
    AuthenticationGuard,
    {
      provide: MEDICAL_RECORD_REPOSITORY,
      useFactory: (source: DataSource) => new MedicalRecordRepository(source),
      inject: [DataSource],
    },
    {
      provide: MedicalRecordService,
      useFactory: (repository: MedicalRecordPort) => new MedicalRecordService(repository),
      inject: [MEDICAL_RECORD_REPOSITORY],
    },
  ],
})
export class MedicalRecordModule {}
