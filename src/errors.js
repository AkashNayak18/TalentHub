/** Domain errors raised by the service layer and mapped to HTTP responses in app.js. */
export class AppError extends Error {
  statusCode = 400;
  constructor(message) { super(message); this.message = message; this.name = this.constructor.name; }
}
export class AuthenticationError extends AppError { statusCode = 401; }
export class ForbiddenError extends AppError { statusCode = 403; }
export class NotFoundError extends AppError { statusCode = 404; }
export class ConflictError extends AppError { statusCode = 409; }
export class BusinessRuleError extends AppError { statusCode = 400; }
export class MethodNotAllowedError extends AppError { statusCode = 405; }

/** 422 with a FastAPI-style `detail` array: [{ loc: ['body', 'cgpa'], msg, type }] */
export class ValidationError extends AppError {
  statusCode = 422;
  constructor(detail) { super('Validation error'); this.detail = detail; }
}
