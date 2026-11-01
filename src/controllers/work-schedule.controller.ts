import { Body, Controller, Get, Inject, Param, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '../domain/user';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { WorkScheduleService } from '../services/work-schedule.service';
@Controller('doctors/:doctorId/work-schedule')
@UseGuards(AuthenticationGuard, RolesGuard)
export class WorkScheduleController {
  constructor(@Inject(WorkScheduleService) private readonly service: WorkScheduleService) {}
  @Get() get(@Param('doctorId') id: string) {
    return this.service.get(id);
  }
  @Put()
  @Roles(UserRole.ADMIN)
  replace(@Param('doctorId') id: string, @Body() input: unknown) {
    return this.service.replace(id, input);
  }
}
