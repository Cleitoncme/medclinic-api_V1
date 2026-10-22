import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './controllers/health.controller';
import { AppExceptionFilter } from './filters/app-exception.filter';
import { AdminModule } from './modules/admin.module';
import { AuthModule } from './modules/auth.module';
import { UserModule } from './modules/user.module';

@Module({
  imports: [UserModule, AuthModule, AdminModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule {}
