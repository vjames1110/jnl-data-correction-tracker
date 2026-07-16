import secrets
import string
from datetime import date


ALPHANUMERIC_CHARACTERS = string.ascii_uppercase + string.digits


def generate_secure_code(length: int = 8) -> str:
    """
    Generate a cryptographically secure uppercase alphanumeric code.
    """

    if length < 4:
        raise ValueError("Secure code length must be at least 4 characters.")

    return "".join(
        secrets.choice(ALPHANUMERIC_CHARACTERS)
        for _ in range(length)
    )


def build_reference_prefix(
    prefix: str,
    reference_date: date | None = None,
) -> str:
    """
    Build a normalized yearly reference prefix.

    Example:
        build_reference_prefix("DCT")
        -> DCT-2026
    """

    effective_date = reference_date or date.today()

    normalized_prefix = prefix.strip().upper().replace(" ", "-")

    if not normalized_prefix:
        raise ValueError("Reference prefix cannot be empty.")

    return f"{normalized_prefix}-{effective_date.year}"


def format_sequence_reference(
    prefix: str,
    sequence: int,
    padding: int = 6,
    reference_date: date | None = None,
) -> str:
    """
    Format a human-readable sequential reference.

    Example:
        format_sequence_reference("DCT", 12)
        -> DCT-2026-000012

    This utility only formats a sequence. The database-backed atomic
    sequence generator will be implemented with the correction module.
    """

    if sequence < 1:
        raise ValueError("Sequence must be greater than zero.")

    if padding < 1:
        raise ValueError("Padding must be greater than zero.")

    reference_prefix = build_reference_prefix(
        prefix=prefix,
        reference_date=reference_date,
    )

    return f"{reference_prefix}-{sequence:0{padding}d}"