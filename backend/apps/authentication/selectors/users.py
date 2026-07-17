from apps.authentication.models import User


def get_user_by_employee_id(
    employee_id: str,
) -> User | None:
    normalized_employee_id = (
        employee_id.strip().upper()
    )

    return (
        User.objects
        .filter(employee_id=normalized_employee_id)
        .first()
    )