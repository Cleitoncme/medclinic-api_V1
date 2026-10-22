import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../entities/user.entity';
import { AppError } from '../utils/app-error';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) throw new AppError(401, 'Authentication is required.');
    if (roles && !roles.includes(auth.role)) {
      throw new AppError(403, 'You do not have permission to access this resource.');
    }
    return true;
  }
}
