import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from './logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError | CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: any = null;

  // Log the error
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Handle different types of errors
  if (error instanceof CustomError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation Error';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        break;
      default:
        statusCode = 400;
        message = 'Database operation failed';
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  } else if (error instanceof SyntaxError) {
    statusCode = 400;
    message = 'Invalid JSON format';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data type';
  }

  // Send error response
  const errorResponse: any = {
    success: false,
    error: {
      message,
      statusCode
    }
  };

  if (details) {
    errorResponse.error.details = details;
  }

  // Include stack trace in development
  if (process.env['NODE_ENV'] === 'development') {
    errorResponse.error.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Utility functions for throwing specific errors
export const throwNotFoundError = (resource: string): never => {
  throw new CustomError(`${resource} not found`, 404);
};

export const throwValidationError = (message: string): never => {
  throw new CustomError(message, 400);
};

export const throwUnauthorizedError = (message: string = 'Unauthorized'): never => {
  throw new CustomError(message, 401);
};

export const throwForbiddenError = (message: string = 'Forbidden'): never => {
  throw new CustomError(message, 403);
};

export const throwConflictError = (message: string): never => {
  throw new CustomError(message, 409);
}; 