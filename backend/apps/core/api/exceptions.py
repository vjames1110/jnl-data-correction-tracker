from typing import Any

from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(
    exc: Exception,
    context: dict[str, Any],
) -> Response | None:
    """
    Return API errors in a predictable application-wide format.
    """

    response = exception_handler(exc, context)

    if response is None:
        return None

    error_data = response.data

    response.data = {
        "success": False,
        "message": "The request could not be completed.",
        "errors": error_data,
        "status_code": response.status_code,
    }

    return response