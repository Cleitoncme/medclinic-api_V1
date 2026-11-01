import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { DomainError } from '../domain/domain-error';
import { MedicalRecordService } from '../services/medical-record.service';
@Controller('patients/:patientId/medical-records')
@UseGuards(AuthenticationGuard)
export class MedicalRecordController {
  constructor(@Inject(MedicalRecordService) private readonly service: MedicalRecordService) {}
  @Post() create(@Param('patientId') id: string, @Req() req: Request, @Body() body: unknown) {
    if (!req.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticacao obrigatoria.');
    return this.service.create(id, req.auth, body);
  }
  @Get() list(
    @Param('patientId') id: string,
    @Req() req: Request,
    @Query() query: Record<string, unknown>,
  ) {
    if (!req.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticacao obrigatoria.');
    return this.service.list(id, req.auth, query);
  }
}
