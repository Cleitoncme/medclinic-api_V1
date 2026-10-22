import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../guards/authentication.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../domain/user';
import type { CreateUserDTO } from '../dtos/user.dto';
import { UserService } from '../services/user.service';
import { DomainError } from '../domain/domain-error';
@Controller('users')
@UseGuards(AuthenticationGuard)
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}
  @Get('me') me(@Req() request: Request) {
    if (!request.auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticação obrigatória.');
    return this.userService.getById(request.auth.id);
  }
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() input: CreateUserDTO) {
    return this.userService.create(input);
  }
}
