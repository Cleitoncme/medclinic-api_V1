import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '../entities/user.entity';
import { DomainError } from '../domain/domain-error';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) throw new DomainError('NAO_AUTENTICADO', 'Autenticação obrigatória.');
    if (roles && !roles.some((role) => auth.roles.includes(role))) {
      throw new DomainError('ACESSO_NEGADO', 'Acesso negado.');
    }
    return true;
  }
}
