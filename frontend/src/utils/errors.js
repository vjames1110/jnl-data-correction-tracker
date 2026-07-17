export function getApiErrorMessage(
  error,
  fallback = "The request could not be completed.",
) {
  return (
    error?.message ??
    error?.response?.data?.message ??
    fallback
  );
}

export function getFieldErrors(error) {
  return (
    error?.errors ??
    error?.response?.data?.errors ??
    null
  );
}

export function isUnauthorizedError(error) {
  return error?.status === 401;
}

export function isForbiddenError(error) {
  return error?.status === 403;
}