import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { AppointmentQueryService } from '../services/appointment-query.service';
import { DomainError } from '../domain/domain-error';
@Controller()
@UseGuards(AuthenticationGuard)
export class AppointmentQueryController {
  constructor(@Inject(AppointmentQueryService) private readonly service: AppointmentQueryService) {}
  @Get('appointments') list(@Query() query: Record<string, unknown>, @Req() request: Request) {
    if (!request.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticacao obrigatoria.');
    return this.service.list(query, request.auth);
  }
  @Get('appointments/:id') get(@Param('id') id: string, @Req() request: Request) {
    if (!request.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticacao obrigatoria.');
    return this.service.get(id, request.auth);
  }
  @Get('doctors/:doctorId/calendar') calendar(
    @Param('doctorId') id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.calendar(id, query);
  }
}
