export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "resource not found") {
    super(404, "not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "manifest_drift", message);
  }
}

export class InputError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "invalid_request", message, details);
  }
}

export class VerificationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, "artifact_verification_failed", message, details);
  }
}
