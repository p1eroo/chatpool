export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
