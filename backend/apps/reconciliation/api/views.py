import uuid
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Prefetch
from django.http import FileResponse
from django.utils import timezone
from rest_framework import parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import (
    MethodNotAllowed,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.permissions import (
    SAFE_METHODS,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import UserRole
from apps.core.api.responses import success_response
from apps.reconciliation.api.permissions import (
    HasReconciliationApprovalAccess,
    HasReconciliationMasterAccess,
    HasReconciliationReportingAccess,
    HasStorePortalAccess,
    can_manage_reconciliation_masters,
)
from apps.reconciliation.api.serializers import (
    ItemCategorySerializer,
    ItemSerializer,
    ItemStandardSerializer,
    ReconciliationEntrySerializer,
    ReconciliationFlagSerializer,
    ReconciliationOutputEntrySerializer,
    ReconciliationPeriodAttachmentSerializer,
    ReconciliationPeriodSerializer,
    ReconciliationToleranceSettingsSerializer,
    SiteItemConfigSerializer,
)
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationApprovalStep,
    ReconciliationEntry,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationPeriodAttachment,
    ReconciliationPeriodStatus,
    ReconciliationToleranceSettings,
    SiteItemConfig,
)
from apps.reconciliation.selectors import dashboard as dashboard_selectors
from apps.reconciliation.selectors import statement_pack as statement_pack_selectors
from apps.reconciliation.services import approvals
from apps.reconciliation.services.attachments import (
    create_attachment as create_reconciliation_attachment,
    delete_attachment as delete_reconciliation_attachment,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
    reopen_period,
    submit_period,
)


def _is_admin_user(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.role
        in {
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
        }
    )


def _can_override_approval(user) -> bool:
    """
    Admin/Super Admin have always been able to act on someone
    else's pending approval step. Director gets the same override
    power (rather than being inserted as a fixed extra stage in
    every route) so they can jump in on any pending period from
    their own portal without every submission being forced through
    them first.
    """
    return bool(
        _is_admin_user(user)
        or (
            user
            and user.is_authenticated
            and user.role == UserRole.DIRECTOR
        )
    )


def _parse_client_id(raw_value):
    """
    Parse an optional client-generated id for idempotent create
    requests (the offline outbox tags every queued create with a
    UUID it generated itself, so a retried request that actually
    succeeded the first time can be recognized instead of duplicated
    or erroring on the unique constraint).
    """
    if raw_value in (None, ""):
        return None

    try:
        return uuid.UUID(str(raw_value))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValidationError(
            {"id": "Must be a valid UUID."}
        ) from exc


def _resolve_period_month(request):
    month_param = request.query_params.get("month")
    if month_param:
        try:
            return date.fromisoformat(
                month_param
            ).replace(day=1)
        except ValueError as exc:
            raise ValidationError(
                {"month": "Use YYYY-MM-DD format."}
            ) from exc

    return (
        dashboard_selectors.latest_reported_month()
        or timezone.now().date().replace(day=1)
    )


def _lock_editable_period(*, period):
    """
    Re-fetch the period row with a row lock so a concurrent entry
    write and a period submit can't race past the editability check.
    Must be called inside an open ``transaction.atomic()`` block.
    """
    locked_period = (
        ReconciliationPeriod.objects.select_for_update(
            of=("self",),
        ).get(pk=period.pk)
    )
    if not locked_period.is_editable:
        raise ValidationError(
            {
                "period": (
                    "This period is no longer "
                    "editable."
                )
            }
        )
    return locked_period


class ReconciliationMasterViewSet(
    viewsets.ModelViewSet
):
    permission_classes = [
        HasReconciliationMasterAccess,
    ]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
    ]
    select_related_fields: tuple[str, ...] = ()
    prefetch_related_fields: tuple[str, ...] = ()
    dropdown_code_field = ""
    dropdown_label_field = ""

    def get_queryset(self):
        queryset = self.queryset

        if self.select_related_fields:
            queryset = queryset.select_related(
                *self.select_related_fields
            )

        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(
                *self.prefetch_related_fields
            )

        if not can_manage_reconciliation_masters(
            self.request.user
        ):
            queryset = queryset.filter(
                is_active=True,
            )

        return queryset

    def _message_prefix(self) -> str:
        return self.queryset.model._meta.verbose_name

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )
            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} records "
                "retrieved successfully."
            ),
            data=serializer.data,
        )

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object()
        )
        return success_response(
            message=(
                f"{self._message_prefix()} retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def perform_create(self, serializer):
        extra = {}
        if hasattr(
            serializer.Meta.model,
            "created_by",
        ):
            extra["created_by"] = self.request.user
            extra["updated_by"] = self.request.user
        serializer.save(**extra)

    def perform_update(self, serializer):
        extra = {}
        if hasattr(
            serializer.Meta.model,
            "updated_by",
        ):
            extra["updated_by"] = self.request.user
        serializer.save(**extra)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )
        self.perform_create(serializer)

        return success_response(
            message=(
                f"{self._message_prefix()} created "
                "successfully."
            ),
            data=serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop(
            "partial",
            False,
        )
        serializer = self.get_serializer(
            self.get_object(),
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(
            raise_exception=True
        )
        self.perform_update(serializer)

        return success_response(
            message=(
                f"{self._message_prefix()} updated "
                "successfully."
            ),
            data=serializer.data,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(
            request,
            *args,
            **kwargs,
        )

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "DELETE",
            detail=(
                "Use the deactivate action instead."
            ),
        )

    def _set_active_state(self, instance, is_active):
        instance.is_active = is_active

        try:
            instance.save(
                update_fields=[
                    "is_active",
                    "updated_at",
                ]
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

        return instance

    @action(
        detail=True,
        methods=["post"],
    )
    def activate(self, request, *args, **kwargs):
        instance = self._set_active_state(
            self.get_object(),
            True,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} activated "
                "successfully."
            ),
            data=self.get_serializer(instance).data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def deactivate(self, request, *args, **kwargs):
        instance = self._set_active_state(
            self.get_object(),
            False,
        )
        return success_response(
            message=(
                f"{self._message_prefix()} deactivated "
                "successfully."
            ),
            data=self.get_serializer(instance).data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def dropdown(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        data = []

        for item in queryset:
            data.append(
                {
                    "id": str(item.id),
                    "code": str(
                        getattr(
                            item,
                            self.dropdown_code_field,
                            "",
                        )
                    ),
                    "label": str(
                        getattr(
                            item,
                            self.dropdown_label_field,
                            str(item),
                        )
                    ),
                    "is_active": item.is_active,
                }
            )

        return success_response(
            message=(
                f"{self._message_prefix()} dropdown "
                "retrieved successfully."
            ),
            data=data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def export(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        serializer = self.get_serializer(
            queryset,
            many=True,
        )

        return success_response(
            message=(
                f"{self._message_prefix()} export "
                "retrieved successfully."
            ),
            data=serializer.data,
        )


class ItemCategoryViewSet(ReconciliationMasterViewSet):
    queryset = ItemCategory.objects.all()
    serializer_class = ItemCategorySerializer
    search_fields = [
        "category_code",
        "category_name",
        "description",
    ]
    filterset_fields = [
        "is_active",
    ]
    ordering_fields = [
        "category_code",
        "category_name",
        "display_order",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "display_order",
        "category_name",
    ]
    dropdown_code_field = "category_code"
    dropdown_label_field = "category_name"


class ItemViewSet(ReconciliationMasterViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    select_related_fields = ("category",)
    search_fields = [
        "item_code",
        "item_name",
        "erp_item_code",
        "description",
    ]
    filterset_fields = [
        "category",
        "reconciliation_type",
        "is_active",
    ]
    ordering_fields = [
        "item_code",
        "item_name",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "item_name",
    ]
    dropdown_code_field = "item_code"
    dropdown_label_field = "item_name"


class ItemStandardViewSet(ReconciliationMasterViewSet):
    queryset = ItemStandard.objects.all()
    serializer_class = ItemStandardSerializer
    select_related_fields = (
        "item",
        "item__category",
        "created_by",
    )
    search_fields = [
        "item__item_code",
        "item__item_name",
        "grade_label",
        "notes",
    ]
    filterset_fields = [
        "item",
        "grade_label",
        "is_active",
    ]
    ordering_fields = [
        "effective_from",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "item__item_name",
        "-effective_from",
    ]


class SiteItemConfigViewSet(ReconciliationMasterViewSet):
    queryset = SiteItemConfig.objects.all()
    serializer_class = SiteItemConfigSerializer
    select_related_fields = (
        "item",
        "site",
        "period",
        "created_by",
    )
    search_fields = [
        "item__item_code",
        "item__item_name",
        "site__site_code",
        "site__site_name",
        "grade_label",
        "notes",
    ]
    filterset_fields = [
        "item",
        "site",
        "period",
        "grade_label",
        "is_active",
    ]
    ordering_fields = [
        "effective_from",
        "created_at",
        "updated_at",
    ]
    ordering = [
        "site__site_name",
        "item__item_name",
        "-effective_from",
    ]


class ReconciliationToleranceSettingsView(APIView):
    permission_classes = [
        HasStorePortalAccess,
    ]

    def get(self, request, *args, **kwargs):
        instance = (
            ReconciliationToleranceSettings.get_solo()
        )
        serializer = (
            ReconciliationToleranceSettingsSerializer(
                instance
            )
        )
        return success_response(
            message=(
                "Tolerance settings retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def patch(self, request, *args, **kwargs):
        if not can_manage_reconciliation_masters(
            request.user
        ):
            raise PermissionDenied(
                "Only admins or Store HO can "
                "update tolerance settings."
            )

        instance = (
            ReconciliationToleranceSettings.get_solo()
        )
        serializer = (
            ReconciliationToleranceSettingsSerializer(
                instance,
                data=request.data,
                partial=True,
            )
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            message=(
                "Tolerance settings updated "
                "successfully."
            ),
            data=serializer.data,
        )


class ReconciliationDashboardView(APIView):
    permission_classes = [
        HasReconciliationReportingAccess,
    ]

    def get(self, request, *args, **kwargs):
        period_month = _resolve_period_month(
            request
        )

        data = {
            "period_month": period_month.isoformat(),
            "company_summary": (
                dashboard_selectors.company_summary(
                    period_month=period_month,
                )
            ),
            "site_summary": (
                dashboard_selectors.site_variance_summary(
                    period_month=period_month,
                )
            ),
            "item_summary": (
                dashboard_selectors.item_variance_summary(
                    period_month=period_month,
                )
            ),
            "trend": (
                dashboard_selectors.company_trend(
                    as_of_month=period_month,
                )
            ),
        }
        return success_response(
            message=(
                "Reconciliation dashboard data "
                "retrieved successfully."
            ),
            data=data,
        )


class ReconciliationStatementPackView(APIView):
    permission_classes = [
        HasReconciliationReportingAccess,
    ]

    def get(self, request, *args, **kwargs):
        period_month = _resolve_period_month(
            request
        )
        site_id = request.query_params.get(
            "site"
        )
        pack = (
            statement_pack_selectors.build_statement_pack(
                period_month=period_month,
                site_id=site_id,
            )
        )

        data = {
            "period_month": period_month.isoformat(),
            "statements": [
                {
                    "period": (
                        ReconciliationPeriodSerializer(
                            item["period"]
                        ).data
                    ),
                    "entries": (
                        ReconciliationEntrySerializer(
                            item["entries"],
                            many=True,
                        ).data
                    ),
                    "output_entries": (
                        ReconciliationOutputEntrySerializer(
                            item["output_entries"],
                            many=True,
                        ).data
                    ),
                }
                for item in pack
            ],
        }
        return success_response(
            message=(
                "Statement pack retrieved "
                "successfully."
            ),
            data=data,
        )


class ReconciliationPeriodViewSet(
    viewsets.ModelViewSet
):
    queryset = (
        ReconciliationPeriod.objects.select_related(
            "site",
            "submitted_by",
        )
        .prefetch_related(
            Prefetch(
                "approval_steps",
                queryset=(
                    ReconciliationApprovalStep.objects.select_related(
                        "approver"
                    ).order_by(
                        "round_number",
                        "sequence",
                    )
                ),
            )
        )
        .all()
    )
    serializer_class = (
        ReconciliationPeriodSerializer
    )
    permission_classes = [
        HasStorePortalAccess,
    ]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    filterset_fields = [
        "site",
        "status",
        "period_month",
    ]
    ordering_fields = [
        "period_month",
        "created_at",
        "updated_at",
    ]
    ordering = ["-period_month"]
    # Store HO prepares and submits periods but is no longer an
    # approver - only Director/Admin/Super Admin can act on a
    # pending step. Reopening a rejected period isn't "approving"
    # (it just unlocks the preparer's own rejected work for a fresh
    # round), so Store HO keeps that one.
    approval_actions = {
        "pending_approvals",
        "approve",
        "reject",
        "return_for_correction",
    }
    reopen_actions = {"reopen"}

    def get_permissions(self):
        if self.action in self.approval_actions:
            return [
                HasReconciliationApprovalAccess()
            ]
        if self.action in self.reopen_actions:
            return [
                HasReconciliationReportingAccess()
            ]
        # Reading a period (list/retrieve/current) is reporting
        # access - Director needs this to open a submitted period
        # from the approval inbox's "View Entries" link. Writing
        # (create is disabled below anyway; patch) stays Store HO/
        # Admin/Super Admin only via HasStorePortalAccess.
        if self.request.method in SAFE_METHODS:
            return [
                HasReconciliationReportingAccess()
            ]
        return super().get_permissions()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(
                page,
                many=True,
            )
            return self.get_paginated_response(
                serializer.data
            )

        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                "Reconciliation periods retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            self.get_object()
        )
        return success_response(
            message=(
                "Reconciliation period retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed(
            "POST",
            detail=(
                "Use the current action to fetch "
                "or create a period for a site "
                "and month."
            ),
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            message=(
                "Reconciliation period updated "
                "successfully."
            ),
            data=serializer.data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def current(self, request, *args, **kwargs):
        from apps.organization.models import Site

        site_id = request.query_params.get("site")
        if not site_id:
            raise ValidationError(
                {
                    "site": (
                        "Site is required."
                    )
                }
            )

        month_param = request.query_params.get(
            "month"
        )
        if month_param:
            try:
                period_month = date.fromisoformat(
                    month_param
                )
            except ValueError as exc:
                raise ValidationError(
                    {
                        "month": (
                            "Use YYYY-MM-DD "
                            "format."
                        )
                    }
                ) from exc
        else:
            period_month = (
                timezone.localdate().replace(
                    day=1
                )
            )

        try:
            site = Site.objects.get(pk=site_id)
        except Site.DoesNotExist as exc:
            raise ValidationError(
                {"site": "Site not found."}
            ) from exc

        period = get_or_create_period(
            site=site,
            period_month=period_month,
        )
        serializer = self.get_serializer(period)
        return success_response(
            message=(
                "Reconciliation period retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def submit(self, request, *args, **kwargs):
        period = self.get_object()
        submit_period(
            period=period,
            user=request.user,
        )
        period.refresh_from_db()
        serializer = self.get_serializer(period)
        return success_response(
            message=(
                "Reconciliation period submitted "
                "successfully."
            ),
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["get"],
    )
    def flags(self, request, *args, **kwargs):
        period = self.get_object()
        serializer = ReconciliationFlagSerializer(
            period.flags.select_related(
                "entry",
                "entry__item",
            ).all(),
            many=True,
        )
        return success_response(
            message=(
                "Reconciliation flags retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def pending_approvals(
        self, request, *args, **kwargs
    ):
        queryset = self.get_queryset().filter(
            status=(
                ReconciliationPeriodStatus.PENDING_APPROVAL
            ),
        )

        if not _can_override_approval(request.user):
            queryset = queryset.filter(
                approval_steps__approver=request.user,
                approval_steps__is_current=True,
            )

        queryset = self.filter_queryset(
            queryset.distinct()
        )
        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                "Pending approvals retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def _current_pending_step(self, period):
        step = (
            period.approval_steps.filter(
                is_current=True,
            )
            .select_related(
                "period",
                "period__site",
                "approver",
            )
            .first()
        )
        if step is None:
            raise ValidationError(
                {
                    "status": (
                        "No pending approval step "
                        "for this period."
                    )
                }
            )
        return step

    @action(
        detail=True,
        methods=["post"],
    )
    def approve(self, request, *args, **kwargs):
        period = self.get_object()
        step = self._current_pending_step(period)
        approvals.approve_step(
            step=step,
            user=request.user,
            comment=request.data.get(
                "comment", ""
            ),
            allow_admin=_can_override_approval(
                request.user
            ),
        )
        period.refresh_from_db()
        serializer = self.get_serializer(period)
        return success_response(
            message=(
                "Reconciliation period approved "
                "successfully."
            ),
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def reject(self, request, *args, **kwargs):
        period = self.get_object()
        step = self._current_pending_step(period)
        approvals.reject_step(
            step=step,
            user=request.user,
            comment=request.data.get(
                "comment", ""
            ),
            allow_admin=_can_override_approval(
                request.user
            ),
        )
        period.refresh_from_db()
        serializer = self.get_serializer(period)
        return success_response(
            message=(
                "Reconciliation period rejected."
            ),
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="return",
        url_name="return",
    )
    def return_for_correction(
        self, request, *args, **kwargs
    ):
        period = self.get_object()
        step = self._current_pending_step(period)
        approvals.return_step(
            step=step,
            user=request.user,
            comment=request.data.get(
                "comment", ""
            ),
            allow_admin=_can_override_approval(
                request.user
            ),
        )
        period.refresh_from_db()
        serializer = self.get_serializer(period)
        return success_response(
            message=(
                "Reconciliation period returned "
                "for correction."
            ),
            data=serializer.data,
        )

    @action(
        detail=True,
        methods=["post"],
    )
    def reopen(self, request, *args, **kwargs):
        period = self.get_object()
        reopened = reopen_period(
            period=period,
            user=request.user,
        )
        serializer = self.get_serializer(reopened)
        return success_response(
            message=(
                "Reconciliation period reopened "
                "for correction."
            ),
            data=serializer.data,
        )


class ReconciliationEntryViewSet(
    viewsets.ModelViewSet
):
    queryset = (
        ReconciliationEntry.objects.select_related(
            "period",
            "period__site",
            "item",
        )
        .prefetch_related("flags")
        .all()
    )
    serializer_class = (
        ReconciliationEntrySerializer
    )
    lookup_field = "id"

    def get_permissions(self):
        # Director needs to read a submitted period's entries from
        # the approval inbox's "View Entries" link; writing stays
        # Store HO/Admin/Super Admin only.
        if self.request.method in SAFE_METHODS:
            return [
                HasReconciliationReportingAccess()
            ]
        return [HasStorePortalAccess()]

    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]
    filterset_fields = [
        "period",
        "item",
        "status",
    ]
    ordering_fields = [
        "created_at",
        "updated_at",
    ]
    ordering = ["item__item_name"]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                "Reconciliation entries retrieved "
                "successfully."
            ),
            data=serializer.data,
        )

    def create(self, request, *args, **kwargs):
        client_id = _parse_client_id(
            request.data.get("id"),
        )
        if client_id:
            existing = (
                self.get_queryset()
                .filter(pk=client_id)
                .first()
            )
            if existing is not None:
                serializer = self.get_serializer(
                    existing
                )
                return success_response(
                    message=(
                        "Reconciliation entry "
                        "already recorded."
                    ),
                    data=serializer.data,
                    status_code=status.HTTP_200_OK,
                )

        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            _lock_editable_period(
                period=serializer.validated_data[
                    "period"
                ],
            )
            extra = {
                "created_by": request.user,
                "updated_by": request.user,
            }
            if client_id:
                extra["id"] = client_id
            serializer.save(**extra)

        return success_response(
            message=(
                "Reconciliation entry saved "
                "successfully."
            ),
            data=serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            _lock_editable_period(
                period=instance.period,
            )
            serializer.save(updated_by=request.user)

        return success_response(
            message=(
                "Reconciliation entry updated "
                "successfully."
            ),
            data=serializer.data,
        )


class ReconciliationOutputEntryViewSet(
    viewsets.ModelViewSet
):
    queryset = (
        ReconciliationOutputEntry.objects
        .select_related(
            "period",
            "period__site",
            "item",
        )
        .all()
    )
    serializer_class = (
        ReconciliationOutputEntrySerializer
    )
    lookup_field = "id"

    def get_permissions(self):
        # Director needs to read a submitted period's production
        # output from the approval inbox's "View Entries" link;
        # writing stays Store HO/Admin/Super Admin only.
        if self.request.method in SAFE_METHODS:
            return [
                HasReconciliationReportingAccess()
            ]
        return [HasStorePortalAccess()]

    http_method_names = [
        "get",
        "post",
        "patch",
        "delete",
        "head",
        "options",
    ]
    filterset_fields = [
        "period",
        "item",
    ]
    ordering = ["item__item_name"]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(
            self.get_queryset()
        )
        serializer = self.get_serializer(
            queryset,
            many=True,
        )
        return success_response(
            message=(
                "Reconciliation output entries "
                "retrieved successfully."
            ),
            data=serializer.data,
        )

    def create(self, request, *args, **kwargs):
        client_id = _parse_client_id(
            request.data.get("id"),
        )
        if client_id:
            existing = (
                self.get_queryset()
                .filter(pk=client_id)
                .first()
            )
            if existing is not None:
                serializer = self.get_serializer(
                    existing
                )
                return success_response(
                    message=(
                        "Reconciliation output "
                        "entry already recorded."
                    ),
                    data=serializer.data,
                    status_code=status.HTTP_200_OK,
                )

        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            _lock_editable_period(
                period=serializer.validated_data[
                    "period"
                ],
            )
            extra = {
                "created_by": request.user,
                "updated_by": request.user,
            }
            if client_id:
                extra["id"] = client_id
            serializer.save(**extra)

        return success_response(
            message=(
                "Reconciliation output entry "
                "saved successfully."
            ),
            data=serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            _lock_editable_period(
                period=instance.period,
            )
            serializer.save(updated_by=request.user)

        return success_response(
            message=(
                "Reconciliation output entry "
                "updated successfully."
            ),
            data=serializer.data,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        with transaction.atomic():
            _lock_editable_period(
                period=instance.period,
            )
            instance.delete()

        return success_response(
            message=(
                "Reconciliation output entry "
                "deleted successfully."
            ),
            data=None,
        )


class ReconciliationPeriodAttachmentViewSet(
    viewsets.ModelViewSet
):
    serializer_class = (
        ReconciliationPeriodAttachmentSerializer
    )
    parser_classes = [
        parsers.MultiPartParser,
        parsers.FormParser,
        parsers.JSONParser,
    ]
    lookup_field = "id"
    http_method_names = [
        "get",
        "post",
        "delete",
        "head",
        "options",
    ]
    filterset_fields = ["period"]
    ordering_fields = ["created_at", "original_name"]
    ordering = ["-created_at"]

    def get_permissions(self):
        # Reading (e.g. Director reviewing evidence attached to a
        # submitted period) is reporting access; uploading/deleting
        # stays Store HO/Admin/Super Admin only, matching entries.
        if self.request.method in SAFE_METHODS:
            return [
                HasReconciliationReportingAccess()
            ]
        return [HasStorePortalAccess()]

    def get_queryset(self):
        queryset = (
            ReconciliationPeriodAttachment.objects.filter(
                is_deleted=False,
            ).select_related(
                "period",
                "period__site",
                "uploaded_by",
            )
        )

        period_id = self.request.query_params.get(
            "period"
        )
        if period_id:
            queryset = queryset.filter(
                period_id=period_id
            )

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        period = serializer.validated_data[
            "period"
        ]

        attachment = create_reconciliation_attachment(
            period=period,
            user=request.user,
            file=serializer.validated_data["file"],
            notes=serializer.validated_data.get(
                "notes", ""
            ),
        )

        return success_response(
            message="Attachment uploaded successfully.",
            data=self.get_serializer(
                attachment
            ).data,
            status_code=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        attachment = delete_reconciliation_attachment(
            attachment=self.get_object(),
            user=request.user,
        )

        return success_response(
            message="Attachment deleted successfully.",
            data=self.get_serializer(
                attachment
            ).data,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="download",
    )
    def download(self, request, *args, **kwargs):
        attachment = self.get_object()

        if not attachment.file:
            raise NotFound(
                "Attachment file was not found."
            )

        try:
            file_handle = attachment.file.open("rb")
        except FileNotFoundError as exc:
            raise NotFound(
                "Attachment file was not found."
            ) from exc

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=attachment.original_name,
            content_type=(
                attachment.content_type
                or "application/octet-stream"
            ),
        )
