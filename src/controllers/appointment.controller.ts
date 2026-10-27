import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../domain/user';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AppointmentService } from '../services/appointment.service';
@Controller('appointments')
@UseGuards(AuthenticationGuard, RolesGuard)
export class AppointmentController {
  constructor(@Inject(AppointmentService) private readonly service: AppointmentService) {}
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SECRETARY)
  create(@Body() input: unknown) {
    return this.service.create(input);
  }
}
