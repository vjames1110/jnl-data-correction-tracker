import re


MULTIPLE_WHITESPACE_PATTERN = re.compile(r"\s+")
NON_CODE_CHARACTER_PATTERN = re.compile(r"[^A-Z0-9_-]+")


def normalize_whitespace(value: str) -> str:
    """
    Remove leading/trailing whitespace and collapse repeated spaces.
    """

    return MULTIPLE_WHITESPACE_PATTERN.sub(
        " ",
        value.strip(),
    )


def normalize_code(value: str) -> str:
    """
    Convert a business code into a normalized uppercase format.

    Example:
        " journal entry "
        -> JOURNAL_ENTRY
    """

    normalized_value = normalize_whitespace(value).upper()
    normalized_value = normalized_value.replace(" ", "_")

    return NON_CODE_CHARACTER_PATTERN.sub(
        "",
        normalized_value,
    )