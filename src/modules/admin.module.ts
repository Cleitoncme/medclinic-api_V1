import { Module } from '@nestjs/common';
import { AdminController } from '../controllers/admin.controller';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';

@Module({ controllers: [AdminController], providers: [AuthenticationGuard, RolesGuard] })
export class AdminModule {}
