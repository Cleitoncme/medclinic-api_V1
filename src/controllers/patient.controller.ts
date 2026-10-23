import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PatientService } from '../services/patient.service';
import type { NewPatient } from '../domain/patient';
import { UserRole } from '../domain/user';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';

@Controller('patients')
@UseGuards(AuthenticationGuard, RolesGuard)
export class PatientController {
  constructor(@Inject(PatientService) private readonly service: PatientService) {}
  @Post()
  @Roles(UserRole.ADMIN, UserRole.SECRETARY)
  create(@Body() input: NewPatient) {
    return this.service.create(input);
  }
  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SECRETARY)
  update(@Param('id') id: string, @Body() input: { name: string }) {
    return this.service.update(id, input);
  }
  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
