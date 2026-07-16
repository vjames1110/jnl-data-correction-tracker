from typing import Any

from rest_framework import status
from rest_framework.response import Response


def success_response(
    *,
    message: str,
    data: Any = None,
    status_code: int = status.HTTP_200_OK,
    meta: dict[str, Any] | None = None,
) -> Response:
    """
    Return a consistent successful API response.
    """

    payload: dict[str, Any] = {
        "success": True,
        "message": message,
        "data": data,
    }

    if meta is not None:
        payload["meta"] = meta

    return Response(
        payload,
        status=status_code,
    )


def error_response(
    *,
    message: str,
    errors: Any = None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    error_code: str | None = None,
) -> Response:
    """
    Return a consistent API error response.
    """

    payload: dict[str, Any] = {
        "success": False,
        "message": message,
        "errors": errors,
        "status_code": status_code,
    }

    if error_code is not None:
        payload["error_code"] = error_code

    return Response(
        payload,
        status=status_code,
    )