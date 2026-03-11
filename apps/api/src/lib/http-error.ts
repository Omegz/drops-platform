export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;
