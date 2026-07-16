import logging
from typing import Any

from django.http import HttpRequest


def build_request_log_context(
    request: HttpRequest | None,
    **extra: Any,
) -> dict[str, Any]:
    """
    Build common metadata for structured request logging.
    """

    context: dict[str, Any] = {
        "request_id": None,
        "request_path": None,
        "request_method": None,
        "user_id": None,
    }

    if request is not None:
        user = getattr(request, "user", None)

        context.update(
            {
                "request_id": getattr(
                    request,
                    "request_id",
                    None,
                ),
                "request_path": request.path,
                "request_method": request.method,
                "user_id": (
                    str(user.pk)
                    if user
                    and getattr(
                        user,
                        "is_authenticated",
                        False,
                    )
                    else None
                ),
            }
        )

    context.update(extra)

    return context


def get_application_logger(name: str) -> logging.Logger:
    """
    Return a namespaced application logger.
    """

    return logging.getLogger(name)