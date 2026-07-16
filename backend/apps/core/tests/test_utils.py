from datetime import date

import pytest

from apps.core.utils.identifiers import (
    build_reference_prefix,
    format_sequence_reference,
    generate_secure_code,
)
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)


def test_generate_secure_code_returns_requested_length():
    code = generate_secure_code(length=12)

    assert len(code) == 12
    assert code.isalnum()
    assert code == code.upper()


def test_generate_secure_code_rejects_short_length():
    with pytest.raises(ValueError):
        generate_secure_code(length=3)


def test_build_reference_prefix():
    result = build_reference_prefix(
        "dct",
        reference_date=date(2026, 7, 16),
    )

    assert result == "DCT-2026"


def test_format_sequence_reference():
    result = format_sequence_reference(
        prefix="DCT",
        sequence=42,
        reference_date=date(2026, 7, 16),
    )

    assert result == "DCT-2026-000042"


def test_format_sequence_reference_rejects_zero():
    with pytest.raises(ValueError):
        format_sequence_reference(
            prefix="DCT",
            sequence=0,
        )


def test_normalize_whitespace():
    assert (
        normalize_whitespace(
            "  Journal    Entry  "
        )
        == "Journal Entry"
    )


def test_normalize_code():
    assert (
        normalize_code(
            " Journal Entry "
        )
        == "JOURNAL_ENTRY"
    )