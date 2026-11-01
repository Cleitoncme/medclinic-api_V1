import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { NewDoctor } from '../domain/doctor';
import { UserRole } from '../domain/user';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { DoctorService } from '../services/doctor.service';
@Controller('doctors')
@UseGuards(AuthenticationGuard, RolesGuard)
export class DoctorController {
  constructor(@Inject(DoctorService) private readonly service: DoctorService) {}
  @Post() @Roles(UserRole.ADMIN) create(@Body() input: NewDoctor) {
    return this.service.create(input);
  }
  @Get() list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
