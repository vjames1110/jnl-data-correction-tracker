/**
 * The backend refuses an edit/hide/unhide/meeting-date-correction
 * past the 48-hour window with this exact wording
 * (``services.edit_access.EDIT_WINDOW_MESSAGE``) - matched here so a
 * popup can offer "Request edit access" right where the refusal
 * happened, instead of a dead-end error.
 *
 * Every ``PermissionDenied`` (DRF's base class or a subclass like
 * ``EditWindowExpired``) is shown a single generic top-level message
 * by the shared API error handler (``apps.core.api.exceptions``), by
 * design - it never leaks a specific denial reason through
 * ``error.message``. The original detail survives underneath, in
 * ``error.errors.detail`` (``normalizeApiError`` always preserves the
 * server's raw ``errors`` object alongside the sanitised message), so
 * that is what needs matching here, not ``error.message``.
 */
export function isEditWindowExpired(error) {
  return Boolean(
    error?.errors?.detail?.includes("48 hours"),
  );
}
