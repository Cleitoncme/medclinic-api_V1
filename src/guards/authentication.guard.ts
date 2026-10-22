import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../entities/user.entity';
import { AppError } from '../utils/app-error';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication token is required.');
    }

    try {
      const token = authorization.slice('Bearer '.length).trim();
      const payload = jwt.verify(token, env.jwt.secret);
      if (
        typeof payload === 'string' ||
        typeof payload.id !== 'string' ||
        !payload.id ||
        (payload.role !== UserRole.ADMIN && payload.role !== UserRole.ATTENDANT)
      ) {
        throw new Error('Invalid token payload.');
      }
      request.auth = { id: payload.id, role: payload.role };
      return true;
    } catch {
      throw new AppError(401, 'Authentication token is invalid or expired.');
    }
  }
}
