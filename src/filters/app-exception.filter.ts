import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { AppError } from '../utils/app-error';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  public catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let statusCode = 500;
    let message = 'Internal server error.';

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
    } else if (error instanceof HttpException) {
      statusCode = error.getStatus();
      message = error.message;
    } else if (
      error instanceof QueryFailedError &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      Reflect.get(error.driverError, 'code') === '23505' &&
      Reflect.get(error.driverError, 'constraint') === 'UQ_users_email'
    ) {
      statusCode = 409;
      message = 'Email is already registered.';
    } else {
      this.logger.error(
        'Unexpected application error.',
        error instanceof Error ? error.stack : undefined,
      );
    }
    response.status(statusCode).json({ statusCode, message });
  }
}
