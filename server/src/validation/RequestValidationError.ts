export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Typed HTTP 400 validation error thrown when Zod schema validation fails.
 */
export class RequestValidationError extends Error {
  public readonly statusCode = 400;
  public readonly issues: ValidationIssue[];

  public constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'RequestValidationError';
    this.issues = issues;
  }
}
