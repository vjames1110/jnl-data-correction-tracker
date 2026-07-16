from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.core.constants.common import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)


class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard pagination used by list APIs.
    """

    page_size = DEFAULT_PAGE_SIZE
    page_size_query_param = "page_size"
    max_page_size = MAX_PAGE_SIZE

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("success", True),
                    (
                        "message",
                        "Records retrieved successfully.",
                    ),
                    ("data", data),
                    (
                        "meta",
                        {
                            "pagination": {
                                "count": self.page.paginator.count,
                                "page": self.page.number,
                                "page_size": self.get_page_size(
                                    self.request
                                ),
                                "total_pages": (
                                    self.page.paginator.num_pages
                                ),
                                "has_next": self.page.has_next(),
                                "has_previous": (
                                    self.page.has_previous()
                                ),
                                "next": self.get_next_link(),
                                "previous": self.get_previous_link(),
                            }
                        },
                    ),
                ]
            )
        )