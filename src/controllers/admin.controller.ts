import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';

@Controller('admin')
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  @Get('ping')
  public ping() {
    return { message: 'Administrator access granted.' };
  }
}
