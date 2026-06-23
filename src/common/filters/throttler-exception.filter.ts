import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Catches ThrottlerException and returns a consistent 429 response
 * with a clear message indicating when to retry.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
    });
  }
}
