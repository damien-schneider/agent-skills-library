const VALIDATION_ERROR_REGEX = /Validation failed: ([\s\S]*?)(?=\s+at\s+|$)/;
const UNCAUGHT_ERROR_REGEX = /Uncaught Error: ([\s\S]*?)(?=\s+at\s+|$)/;

/**
 * Parses Convex validation error messages into individual error strings.
 *
 * Convex validation errors follow the format:
 * "Validation failed: Error 1, Error 2, Error 3"
 *
 * @param error - The error object or message to parse
 * @returns Array of individual error messages, or a generic fallback
 */
export function parseValidationErrors(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);

  // Check if it's a validation error from Convex
  const validationMatch = message.match(VALIDATION_ERROR_REGEX);
  if (validationMatch?.[1]) {
    return validationMatch[1].split(", ").filter(Boolean);
  }

  // If it's not a validation error but contains "Uncaught Error:", strip metadata
  const cleanMatch = message.match(UNCAUGHT_ERROR_REGEX);
  if (cleanMatch?.[1]) {
    return [cleanMatch[1]];
  }

  return [message];
}

/**
 * Extracts a user-friendly error message from any error type.
 *
 * @param error - The error object or message
 * @param fallback - Fallback message if extraction fails
 * @returns A user-friendly error message
 */
export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred"
): string {
  const errors = parseValidationErrors(error);
  if (errors.length > 0 && errors[0] !== String(error)) {
    return errors.join(". ");
  }

  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

/**
 * Maps validation error messages to form field names.
 * This helps associate server errors with specific form fields.
 */
const FIELD_ERROR_PATTERNS: Record<string, RegExp[]> = {
  name: [/^Name\b/i],
  description: [/^Description\b/i],
  content: [/^Content\b/i, /^Markdown\b/i],
  tags: [/^Tag\b/i, /tags?\s+allowed/i],
  general: [/prohibited\s+patterns/i],
};

/**
 * Parses validation errors and maps them to form field names.
 *
 * @param error - The error object or message to parse
 * @returns Record of field names to error messages
 */
export function parseFieldErrors(error: unknown): Record<string, string> {
  const errors = parseValidationErrors(error);
  const fieldErrors: Record<string, string> = {};

  for (const errorMsg of errors) {
    let matched = false;

    for (const [field, patterns] of Object.entries(FIELD_ERROR_PATTERNS)) {
      if (patterns.some((pattern) => pattern.test(errorMsg))) {
        // Use 'submit' key for general errors to display at form level
        const key = field === "general" ? "submit" : field;
        fieldErrors[key] = fieldErrors[key]
          ? `${fieldErrors[key]}. ${errorMsg}`
          : errorMsg;
        matched = true;
        break;
      }
    }

    // If no field matched, add to submit errors
    if (!matched) {
      fieldErrors.submit = fieldErrors.submit
        ? `${fieldErrors.submit}. ${errorMsg}`
        : errorMsg;
    }
  }

  return fieldErrors;
}
