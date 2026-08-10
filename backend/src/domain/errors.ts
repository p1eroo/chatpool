export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string,
    readonly details?: Record<string, unknown>
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

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permiso para esta acción", code = "FORBIDDEN") {
    super(message, 403, code);
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

export class SessionExpiredError extends UnauthorizedError {
  constructor(message = "Tu sesión expiró. Vuelve a iniciar sesión.") {
    super(message, "SESSION_EXPIRED");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404, "NOT_FOUND");
  }
}
