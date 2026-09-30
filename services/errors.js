// Errors a service can throw on purpose; app.js turns them into status codes
class AppError extends Error {}

class RuleError extends AppError {
  status = 400;
}

class NotFoundError extends AppError {
  status = 404;
}

class ConflictError extends AppError {
  status = 409;
}

module.exports = { AppError, RuleError, NotFoundError, ConflictError };
