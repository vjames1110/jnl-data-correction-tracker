import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"
RESPONSE_REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware:
    """
    Attach a unique request identifier to every incoming request.

    A trusted upstream request ID can be reused. Otherwise, a UUID is
    generated.
    """

    def __init__(
        self,
        get_response: Callable[[HttpRequest], HttpResponse],
    ) -> None:
        self.get_response = get_response

    def __call__(
        self,
        request: HttpRequest,
    ) -> HttpResponse:
        incoming_request_id = request.META.get(
            REQUEST_ID_HEADER
        )

        request.request_id = (
            incoming_request_id
            or str(uuid.uuid4())
        )

        response = self.get_response(request)

        response[RESPONSE_REQUEST_ID_HEADER] = (
            request.request_id
        )

        return response