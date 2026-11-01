import { Body, Controller, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '../domain/domain-error';
import { AppointmentStatusService } from '../services/appointment-status.service';
import { UserRole } from '../domain/user';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AppointmentService } from '../services/appointment.service';
@Controller('appointments')
@UseGuards(AuthenticationGuard, RolesGuard)
export class AppointmentController {
  constructor(
    @Inject(AppointmentService) private readonly service: AppointmentService,
    @Inject(AppointmentStatusService) private readonly statusService: AppointmentStatusService,
  ) {}
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Req() request: Request, @Body() input: unknown) {
    if (!request.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticacao obrigatoria.');
    return this.statusService.update(id, request.auth, input);
  }
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SECRETARY)
  create(@Body() input: unknown) {
    return this.service.create(input);
  }
}
