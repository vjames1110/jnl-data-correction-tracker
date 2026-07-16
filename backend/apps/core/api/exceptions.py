import logging
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    ParseError,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler


logger = logging.getLogger(__name__)


def _resolve_error_code(exc: Exception) -> str:
    error_code_map = {
        ValidationError: "VALIDATION_ERROR",
        NotAuthenticated: "NOT_AUTHENTICATED",
        AuthenticationFailed: "AUTHENTICATION_FAILED",
        PermissionDenied: "PERMISSION_DENIED",
        DjangoPermissionDenied: "PERMISSION_DENIED",
        NotFound: "NOT_FOUND",
        Http404: "NOT_FOUND",
        MethodNotAllowed: "METHOD_NOT_ALLOWED",
        ParseError: "PARSE_ERROR",
        Throttled: "REQUEST_THROTTLED",
    }

    for exception_class, error_code in error_code_map.items():
        if isinstance(exc, exception_class):
            return error_code

    return "REQUEST_FAILED"


def _resolve_message(
    exc: Exception,
    response_data: Any,
) -> str:
    if isinstance(exc, ValidationError):
        return "The request data is invalid."

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "Authentication is required or the provided credentials are invalid."

    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return "You do not have permission to perform this action."

    if isinstance(exc, (NotFound, Http404)):
        return "The requested resource was not found."

    if isinstance(exc, MethodNotAllowed):
        return "This HTTP method is not allowed for the requested resource."

    if isinstance(exc, ParseError):
        return "The request body could not be parsed."

    if isinstance(exc, Throttled):
        return "Too many requests were received. Please try again later."

    if isinstance(response_data, dict):
        detail = response_data.get("detail")

        if detail:
            return str(detail)

    return "The request could not be completed."


def custom_exception_handler(
    exc: Exception,
    context: dict[str, Any],
) -> Response | None:
    """
    Convert known API exceptions into a consistent response structure.

    Unknown exceptions are logged and left for Django's normal
    server-error handling.
    """

    response = exception_handler(exc, context)

    if response is None:
        logger.exception(
            "Unhandled API exception",
            exc_info=exc,
            extra={
                "view": str(context.get("view")),
                "request_path": getattr(
                    context.get("request"),
                    "path",
                    None,
                ),
            },
        )
        return None

    response.data = {
        "success": False,
        "message": _resolve_message(
            exc=exc,
            response_data=response.data,
        ),
        "errors": response.data,
        "status_code": response.status_code,
        "error_code": _resolve_error_code(exc),
    }

    return response