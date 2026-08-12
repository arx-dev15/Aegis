import { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500
  const message = statusCode === 500 ? 'Internal server error' : err.message

  if (statusCode === 500) {
    console.error('[ERROR]', err)
  }

  res.status(statusCode).json({
    error: {
      message,
      code: err.code ?? 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && statusCode === 500
        ? { stack: err.stack }
        : {}),
    },
  })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  })
}

export function createError(message: string, statusCode: number, code?: string): ApiError {
  const err: ApiError = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}
