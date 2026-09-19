from contextlib import contextmanager

from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from rest_framework.exceptions import ValidationError

from apps.organization.models import Site


def get_site_or_400(site_id):
    """The Site for a ``?site=`` value, or a 400 (never a 500)."""
    if not site_id:
        raise ValidationError({"site": "Site is required."})
    try:
        return Site.objects.get(pk=site_id)
    except (
        Site.DoesNotExist,
        DjangoValidationError,
        ValueError,
        TypeError,
    ) as exc:
        raise ValidationError(
            {"site": "Site not found."}
        ) from exc


@contextmanager
def as_drf_validation():
    """
    Model ``full_clean()`` raises Django's ValidationError, which DRF
    does not turn into a 400 - convert it.
    """
    try:
        yield
    except DjangoValidationError as exc:
        detail = (
            exc.message_dict
            if hasattr(exc, "error_dict")
            else exc.messages
        )
        raise ValidationError(detail) from exc
