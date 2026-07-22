import re


def build_abbreviation(
    value,
    *,
    min_length=3,
    max_length=12,
):
    tokens = re.findall(
        r"[A-Za-z0-9]+",
        str(value or "").strip(),
    )

    if not tokens:
        return ""

    normalized_tokens = [
        token.upper() for token in tokens
    ]

    if len(normalized_tokens) == 1:
        token = normalized_tokens[0]
        return token[: min(len(token), min_length)]

    if all(
        len(token) <= 4
        for token in normalized_tokens
    ):
        abbreviation = "".join(normalized_tokens)
    else:
        abbreviation = "".join(
            token[0]
            for token in normalized_tokens
            if token
        )

    return abbreviation[:max_length]


def next_unique_code(
    model,
    field_name,
    base_code,
    *,
    exclude_pk=None,
    scope=None,
    max_length=30,
):
    base_code = str(base_code or "").upper()[
        :max_length
    ]
    if not base_code:
        return ""

    queryset = model.objects.all()
    if exclude_pk:
        queryset = queryset.exclude(pk=exclude_pk)

    if scope:
        queryset = queryset.filter(**scope)

    existing_codes = set(
        queryset.filter(
            **{f"{field_name}__startswith": base_code}
        ).values_list(field_name, flat=True)
    )

    if base_code not in existing_codes:
        return base_code

    suffix = 2
    while True:
        suffix_text = str(suffix)
        candidate = (
            f"{base_code[: max_length - len(suffix_text)]}"
            f"{suffix_text}"
        )
        if candidate not in existing_codes:
            return candidate
        suffix += 1


def next_prefixed_sequence(
    model,
    field_name,
    prefix,
    *,
    digits=5,
    exclude_pk=None,
):
    prefix = str(prefix or "").upper()
    pattern = re.compile(
        rf"^{re.escape(prefix)}(\d+)$"
    )
    highest = 0

    queryset = model.objects.filter(
        **{f"{field_name}__startswith": prefix}
    )
    if exclude_pk:
        queryset = queryset.exclude(pk=exclude_pk)

    for value in queryset.values_list(
        field_name,
        flat=True,
    ):
        match = pattern.match(str(value or ""))
        if match:
            highest = max(
                highest,
                int(match.group(1)),
            )

    return f"{prefix}{highest + 1:0{digits}d}"
