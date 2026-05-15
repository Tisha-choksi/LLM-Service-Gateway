export class HttpError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function toHttpError(error) {
  if (error?.statusCode) return error;
  return new HttpError(500, "Internal server error");
}
