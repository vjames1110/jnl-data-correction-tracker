from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.corrections.models import (
    CorrectionRequestReferenceSequence,
)


REFERENCE_PREFIX = "DCT"
REFERENCE_DIGITS = 6


def generate_request_reference(
    *,
    year: int | None = None,
) -> str:
    """
    Generate a unique year-based request reference under a DB lock.
    """

    request_year = year or timezone.localdate().year

    with transaction.atomic():
        sequence = _get_locked_sequence(request_year)
        sequence.last_number += 1
        sequence.save(
            update_fields=[
                "last_number",
                "updated_at",
            ]
        )

        return (
            f"{REFERENCE_PREFIX}-{request_year}-"
            f"{sequence.last_number:0{REFERENCE_DIGITS}d}"
        )


def _get_locked_sequence(
    year: int,
) -> CorrectionRequestReferenceSequence:
    queryset = (
        CorrectionRequestReferenceSequence.objects.select_for_update()
    )

    try:
        return queryset.get(year=year)
    except CorrectionRequestReferenceSequence.DoesNotExist:
        try:
            CorrectionRequestReferenceSequence.objects.create(
                year=year,
                last_number=0,
            )
        except IntegrityError:
            pass

    return queryset.get(year=year)
