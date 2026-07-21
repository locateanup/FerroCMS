import type { Context } from 'hono';

/** A structured, client-safe API error. Never leaks stack traces. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) =>
    new ApiError(400, 'bad_request', message, details),
  unauthorized: (message = 'Authentication required.') =>
    new ApiError(401, 'unauthorized', message),
  forbidden: (message = 'You do not have permission to do that.') =>
    new ApiError(403, 'forbidden', message),
  notFound: (what = 'Resource') => new ApiError(404, 'not_found', `${what} not found.`),
  conflict: (message: string) => new ApiError(409, 'conflict', message),
  validation: (details: unknown) =>
    new ApiError(422, 'validation_error', 'The submitted data is invalid.', details),
};

/** Convert any thrown value into a JSON error response. */
export function toErrorResponse(c: Context, err: unknown): Response {
  if (err instanceof ApiError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as never,
    );
  }
  // Unexpected: log server-side, return an opaque 500.
  console.error('Unhandled error:', err);
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong.' } }, 500);
}
