export class AppError extends Error {
  constructor(code, message, status = 400) {
    super(message); this.code = code; this.status = status;
  }
}
export function publicError(error) {
  if (error instanceof AppError) return { status: error.status, error: { code: error.code, message: error.message } };
  return { status: 500, error: { code: 'internal_error', message: 'The comparison could not be completed. Please try again.' } };
}
