import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isRoles } from '../rules/user-roles.rules';
import { DomainError } from '../domain/domain-error';
@Injectable()
export class AuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      throw new DomainError('NAO_AUTENTICADO', 'Token obrigatório.');
    try {
      const payload = jwt.verify(authorization.slice(7).trim(), env.jwt.secret, {
        algorithms: ['HS256'],
      });
      if (
        typeof payload === 'string' ||
        typeof payload.id !== 'string' ||
        !payload.id ||
        !isRoles(payload.roles) ||
        typeof payload.exp !== 'number'
      )
        throw new Error('Payload inválido.');
      request.auth = { id: payload.id, roles: payload.roles };
      return true;
    } catch {
      throw new DomainError('NAO_AUTENTICADO', 'Token inválido ou expirado.');
    }
  }
}
