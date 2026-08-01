export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

export class SessionRevokedError extends UnauthorizedError {
  constructor() {
    super(
      "Tu sesión se cerró porque iniciaste sesión en otro dispositivo",
      "SESSION_REVOKED"
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404, "NOT_FOUND");
  }
}
