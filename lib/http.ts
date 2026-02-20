import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiErrorShape {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const ok = <T>(data: T, init?: number | ResponseInit) => {
  if (typeof init === 'number') {
    return NextResponse.json(data, { status: init })
  }

  return NextResponse.json(data, init)
}

export const fail = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
) => {
  const payload: ApiErrorShape = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }

  return NextResponse.json(payload, { status })
}

export const withErrorHandling = <TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
) => {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.status, error.code, error.message, error.details)
      }

      if (error instanceof ZodError) {
        return fail(400, 'VALIDATION_ERROR', 'Request validation failed', {
          issues: error.issues,
        })
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
      ) {
        const supabaseLike = error as {
          code?: string
          message: string
          details?: unknown
          hint?: unknown
        }

        return fail(500, supabaseLike.code ?? 'INTERNAL_ERROR', supabaseLike.message, {
          details: supabaseLike.details,
          hint: supabaseLike.hint,
        })
      }

      return fail(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
    }
  }
}

export const notFound = (message = 'Not found'): never => {
  throw new ApiError(404, 'NOT_FOUND', message)
}

export const forbidden = (message = 'Forbidden'): never => {
  throw new ApiError(403, 'FORBIDDEN', message)
}

export const unauthorized = (message = 'Unauthorized'): never => {
  throw new ApiError(401, 'UNAUTHORIZED', message)
}

export const badRequest = (message: string, details?: unknown): never => {
  throw new ApiError(400, 'BAD_REQUEST', message, details)
}

export const conflict = (message: string, details?: unknown): never => {
  throw new ApiError(409, 'CONFLICT', message, details)
}
