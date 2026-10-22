import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DomainError, type ErrorCode } from '../domain/domain-error';
const statuses: Record<ErrorCode, number> = {
  DADOS_INVALIDOS: 400,
  NAO_AUTENTICADO: 401,
  CREDENCIAIS_INVALIDAS: 401,
  ACESSO_NEGADO: 403,
  RECURSO_NAO_ENCONTRADO: 404,
  EMAIL_JA_CADASTRADO: 409,
};
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    let statusCode = 500;
    let error = 'ERRO_INTERNO';
    let message = 'Erro interno do servidor.';
    if (exception instanceof DomainError) {
      statusCode = statuses[exception.code];
      error = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException && exception.getStatus() < 500) {
      statusCode = exception.getStatus();
      error =
        statusCode === 404
          ? 'RECURSO_NAO_ENCONTRADO'
          : statusCode === 401
            ? 'NAO_AUTENTICADO'
            : statusCode === 403
              ? 'ACESSO_NEGADO'
              : 'DADOS_INVALIDOS';
      message = statusCode === 404 ? 'Rota não encontrada.' : 'Requisição inválida.';
    } else if (
      exception instanceof QueryFailedError &&
      exception.driverError &&
      Reflect.get(exception.driverError, 'code') === '23505' &&
      Reflect.get(exception.driverError, 'constraint') === 'UQ_users_email'
    ) {
      statusCode = 409;
      error = 'EMAIL_JA_CADASTRADO';
      message = 'E-mail já cadastrado.';
    } else {
      this.logger.error(
        'Falha inesperada.',
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, error, message });
  }
}
