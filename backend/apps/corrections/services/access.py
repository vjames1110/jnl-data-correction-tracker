from django.db.models import Q
from django.utils import timezone

from apps.authentication.models import UserRole
from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
)
from apps.organization.models import DirectorMapping


def visible_request_queryset(user):
    queryset = CorrectionRequest.objects.filter(
        is_deleted=False
    )

    if _is_admin_user(user):
        return queryset

    visibility = Q(requester=user) | Q(current_owner=user)

    if user.has_role(UserRole.DIRECTOR):
        visibility |= (
            _director_authority_query(user)
            & ~Q(current_status=CorrectionRequestStatus.DRAFT)
        )

    if user.has_role(UserRole.RESPONSIBLE_PERSON):
        visibility |= Q(current_owner=user)

    return queryset.filter(visibility).distinct()


def can_access_request(
    *,
    request: CorrectionRequest,
    user,
) -> bool:
    if not user or not user.is_authenticated:
        return False

    if request.is_deleted:
        return False

    if _is_admin_user(user):
        return True

    if (
        request.requester_id == user.id
        or request.current_owner_id == user.id
    ):
        return True

    if user.has_role(UserRole.DIRECTOR):
        if (
            request.current_status
            == CorrectionRequestStatus.DRAFT
        ):
            return False
        return _director_authorized_for_request(
            request=request,
            user=user,
        )

    return False


def can_cancel_request(
    *,
    request: CorrectionRequest,
    user,
) -> bool:
    if _is_admin_user(user):
        return True

    return request.requester_id == user.id


def _is_admin_user(user) -> bool:
    return bool(
        user
        and (
            user.is_staff
            or user.has_role(
                UserRole.SUPER_ADMIN,
                UserRole.ADMIN,
            )
        )
    )


def _director_authority_query(user) -> Q:
    mappings = _active_director_mappings(user)
    site_ids = list(
        mappings.exclude(site__isnull=True).values_list(
            "site_id",
            flat=True,
        )
    )
    department_ids = list(
        mappings.exclude(
            department__isnull=True
        ).values_list(
            "department_id",
            flat=True,
        )
    )

    query = Q()
    if site_ids:
        query |= Q(site_id__in=site_ids)
    if department_ids:
        query |= Q(department_id__in=department_ids)
    return query


def _director_authorized_for_request(
    *,
    request: CorrectionRequest,
    user,
) -> bool:
    # Only compare fields the request actually has a value for -
    # Q(site_id=None) would otherwise match every mapping whose own
    # site_id is null too (e.g. a department-only mapping), granting
    # a director access to a request that has no site at all.
    query = Q()
    has_clause = False
    if request.site_id:
        query |= Q(site_id=request.site_id)
        has_clause = True
    if request.department_id:
        query |= Q(
            department_id=request.department_id
        )
        has_clause = True

    if not has_clause:
        return False

    mappings = _active_director_mappings(user)
    return mappings.filter(query).exists()


def _active_director_mappings(user):
    today = timezone.localdate()
    return DirectorMapping.objects.filter(
        director=user,
        is_active=True,
    ).filter(
        Q(effective_from__isnull=True)
        | Q(effective_from__lte=today),
        Q(effective_to__isnull=True)
        | Q(effective_to__gte=today),
    )
