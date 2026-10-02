/** An error we expect and want to show to the API caller with a clear message. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required.") => new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg: string) => new AppError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found.") => new AppError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, code = "CONFLICT") => new AppError(409, code, msg);
