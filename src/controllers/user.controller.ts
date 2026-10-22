import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { UserService } from '../services/user.service';
import { AppError } from '../utils/app-error';

@Controller('users')
@UseGuards(AuthenticationGuard)
export class UserController {
  public constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Get('me')
  public async me(@Req() request: Request) {
    if (!request.auth) throw new AppError(401, 'Authentication is required.');
    return { user: await this.userService.getById(request.auth.id) };
  }
}
