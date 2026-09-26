from datetime import date, timedelta
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.parsers import (
    FormParser,
    MultiPartParser,
)
from rest_framework.views import APIView

from apps.core.api.responses import success_response
from apps.project_monitor.api.common import (
    as_drf_validation,
    get_site_or_400,
)
from apps.project_monitor.api.permissions import (
    HasFinanceRoleAccess,
)
from apps.project_monitor.models import (
    DprDayUnlock,
    DprEntry,
    DprEntrySource,
    DprItem,
    RaBill,
    RaBillKind,
    RateEscalation,
)
from apps.project_monitor.services import (
    billing,
    boq,
    contract_finance,
    dpr,
    dpr_import,
    measurement,
    site_access,
)

MAX_GRID_EDITS = 3000
REGISTER_LIMIT = 1000
XLSX_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "spreadsheetml.sheet"
)


def _qty_field(**kwargs):
    return serializers.DecimalField(
        max_digits=14, decimal_places=3, **kwargs
    )


def _money_field(**kwargs):
    return serializers.DecimalField(
        max_digits=16, decimal_places=2, **kwargs
    )


def _authority_rate_field():
    return serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )


def _percent_field():
    return serializers.DecimalField(
        max_digits=7,
        decimal_places=3,
        required=False,
        allow_null=True,
        min_value=Decimal("-100"),
        max_value=Decimal("500"),
    )


class DprItemWriteSerializer(serializers.Serializer):
    item_no = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    description = serializers.CharField(max_length=300)
    unit = serializers.CharField(
        max_length=30, required=False, allow_blank=True
    )
    scope_qty = _qty_field(required=False, min_value=0)
    rate = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    concrete_per_unit = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        required=False,
        min_value=0,
    )
    tmt_kg_per_unit = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        required=False,
        min_value=0,
    )
    parent = serializers.UUIDField(
        required=False, allow_null=True
    )
    is_heading = serializers.BooleanField(required=False)
    authority_rate = _authority_rate_field()
    tender_percent = _percent_field()


class DprSubItemSerializer(serializers.Serializer):
    """One row of the Sub-items table when a group is created."""

    item_no = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    description = serializers.CharField(max_length=300)
    unit = serializers.CharField(
        max_length=30, required=False, allow_blank=True
    )
    scope_qty = _qty_field(required=False, min_value=0)
    rate = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    authority_rate = _authority_rate_field()
    tender_percent = _percent_field()


class DprItemCreateSerializer(DprItemWriteSerializer):
    children = DprSubItemSerializer(many=True, required=False)


class DprItemUpdateSerializer(DprItemWriteSerializer):
    description = serializers.CharField(
        max_length=300, required=False
    )
    is_active = serializers.BooleanField(required=False)


class EscalationSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    effective_from = serializers.DateField()
    percent = serializers.DecimalField(
        max_digits=7, decimal_places=3
    )
    note = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class GridEditSerializer(serializers.Serializer):
    item = serializers.UUIDField()
    date = serializers.DateField()
    qty = _qty_field(min_value=0)


class GridSaveSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    edits = GridEditSerializer(many=True)


class DetailedEntrySerializer(serializers.Serializer):
    site = serializers.UUIDField()
    item = serializers.UUIDField()
    date = serializers.DateField()
    qty = _qty_field()
    location = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    agency = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


def _dimension_field():
    return serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        required=False,
        allow_null=True,
    )


class MeasurementLineSerializer(serializers.Serializer):
    description = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    nos = _dimension_field()
    length = _dimension_field()
    breadth = _dimension_field()
    depth = _dimension_field()
    is_deduction = serializers.BooleanField(required=False)
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class MeasurementSheetSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    item = serializers.UUIDField()
    date = serializers.DateField()
    lines = MeasurementLineSerializer(many=True)


class UnlockSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    date = serializers.DateField()
    reason = serializers.CharField(max_length=300)


class BillLineSerializer(serializers.Serializer):
    item = serializers.UUIDField()
    qty = _qty_field(min_value=0)


class BillCreateSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    bill_no = serializers.CharField(max_length=50)
    bill_date = serializers.DateField()
    kind = serializers.ChoiceField(
        choices=RaBillKind.choices,
        default=RaBillKind.ITEMS,
    )
    amount = _money_field(
        required=False, allow_null=True, min_value=0
    )
    lines = BillLineSerializer(
        many=True, required=False, default=list
    )
    received_amount = _money_field(
        required=False, allow_null=True, min_value=0
    )
    received_on = serializers.DateField(
        required=False, allow_null=True
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class BillReceiptSerializer(serializers.Serializer):
    received_amount = _money_field(
        required=False, allow_null=True, min_value=0
    )
    received_on = serializers.DateField(
        required=False, allow_null=True
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class ContractDetailsSerializer(serializers.Serializer):
    contract_no = serializers.CharField(
        max_length=100, required=False, allow_blank=True
    )
    varied_value = _money_field(
        required=False, allow_null=True, min_value=0
    )
    opening_billed_value = _money_field(
        required=False, min_value=0
    )
    opening_bill_no = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    opening_bill_date = serializers.DateField(
        required=False, allow_null=True
    )
    tender_percent = _percent_field()

    def validate(self, attrs):
        if (
            attrs.get("opening_billed_value")
            and attrs.get("opening_bill_date") is None
        ):
            raise serializers.ValidationError(
                {
                    "opening_bill_date": (
                        "Give the date of the last bill "
                        "raised before this system."
                    )
                }
            )
        return attrs


def _site(request, key="site"):
    source = (
        request.query_params.get(key)
        or request.data.get(key)
    )
    return get_site_or_400(source)


def _viewable_site(request):
    site = _site(request)
    site_access.ensure_can_view(request.user, site)
    return site


def _enterable_site(request):
    site = _site(request)
    site_access.ensure_can_enter(request.user, site)
    return site


def _resolve_parent(site, parent_id):
    """The group an item goes under, on this same project."""
    if parent_id is None:
        return None
    parent = DprItem.objects.filter(
        site=site, pk=parent_id
    ).first()
    if parent is None:
        raise ValidationError(
            {"parent": "That group is not on this project."}
        )
    return parent


def _parse_date(raw, field, default=None):
    if not raw:
        return default
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError(
            {field: "Use the format YYYY-MM-DD."}
        ) from exc


class DprAccessAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        user = request.user
        return success_response(
            message="Access retrieved successfully.",
            data={
                "can_view": site_access.can_view_finance(
                    user, site
                ),
                "can_enter": site_access.can_enter_dpr_bills(
                    user, site
                ),
                "can_unlock": site_access.can_unlock_days(
                    user
                ),
                "edit_window_days": dpr.DPR_EDIT_WINDOW_DAYS,
            },
        )


class DprContractDetailsAPIView(APIView):
    """Finance details on the Site: LOA no, varied value, opening bill."""

    permission_classes = [HasFinanceRoleAccess]

    @staticmethod
    def _payload(site):
        return {
            "contract_no": site.contract_no,
            "original_value": site.project_value,
            "varied_value": site.varied_value,
            "opening_billed_value": site.opening_billed_value,
            "opening_bill_no": site.opening_bill_no,
            "opening_bill_date": site.opening_bill_date,
            "tender_percent": site.tender_percent,
            "boq_total": boq.boq_total(site),
        }

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        return success_response(
            message="Contract details retrieved successfully.",
            data=self._payload(site),
        )

    def patch(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = ContractDetailsSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        percent_changed = (
            "tender_percent" in serializer.validated_data
            and serializer.validated_data["tender_percent"]
            != site.tender_percent
        )
        for field, value in serializer.validated_data.items():
            setattr(site, field, value)
        with as_drf_validation():
            site.save()
        payload = self._payload(site)
        if percent_changed:
            # Every item priced from an authority rate follows the
            # new percentage; recorded work keeps its old rate.
            with as_drf_validation():
                payload["recalculated"] = boq.recalculate_rates(
                    site, actor=request.user
                )
            payload["boq_total"] = boq.boq_total(site)
        return success_response(
            message="Contract details updated successfully.",
            data=payload,
        )


class DprItemListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        return success_response(
            message="DPR items retrieved successfully.",
            data={
                "contract_value": dpr.contract_value(site),
                "tender_percent": site.tender_percent,
                "boq_total": boq.boq_total(site),
                "items": dpr.build_item_rows(site),
            },
        )

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = DprItemCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        children = fields.pop("children", [])
        if "parent" in fields:
            fields["parent"] = _resolve_parent(
                site, fields["parent"]
            )
        with as_drf_validation():
            item = dpr.create_item_with_children(
                site=site,
                children=children,
                actor=request.user,
                **fields,
            )
        return success_response(
            message="DPR item added successfully.",
            data={"id": item.id},
        )


class DprItemDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    @staticmethod
    def _get_item(pk):
        try:
            return DprItem.objects.select_related(
                "site"
            ).get(pk=pk)
        except DprItem.DoesNotExist as exc:
            raise NotFound("DPR item not found.") from exc

    def patch(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        site_access.ensure_can_enter(request.user, item.site)
        serializer = DprItemUpdateSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            if field == "parent":
                value = _resolve_parent(item.site, value)
            setattr(item, field, value)
        item.updated_by = request.user
        with as_drf_validation():
            item.save()
        return success_response(
            message="DPR item updated successfully.",
            data={"id": item.id},
        )

    def delete(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        site_access.ensure_can_enter(request.user, item.site)
        dpr.delete_item(item)
        return success_response(
            message="DPR item deleted successfully.",
            data=None,
        )


class DprItemImportAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a file."})
        result = dpr_import.import_items(
            site, upload, actor=request.user
        )
        return success_response(
            message="Item list imported.", data=result
        )


class DprUploadAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a file."})
        result = dpr_import.import_dpr_entries(
            site, upload, actor=request.user
        )
        return success_response(
            message="DPR file imported.", data=result
        )


class DprTemplateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        kind = request.query_params.get("kind", "dpr")
        if kind == "items":
            content = dpr_import.build_item_template()
            filename = "dpr-item-list-template.xlsx"
        else:
            content = dpr_import.build_dpr_template(site)
            filename = "dpr-upload-template.xlsx"
        response = HttpResponse(
            content, content_type=XLSX_TYPE
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{filename}"'
        )
        return response


class DprGridAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        today = timezone.localdate()
        end = _parse_date(
            request.query_params.get("to"), "to", today
        )
        try:
            days = int(request.query_params.get("days", 31))
        except ValueError as exc:
            raise ValidationError(
                {"days": "Days must be a number."}
            ) from exc
        days = max(1, min(days, 92))
        start, end = dpr.grid_window(end, days)

        unlocked = dpr.unlocked_dates(site, start, end)
        day_qty = dpr.day_qty_map(site, start, end)
        day_values = dpr.day_value_map(site, start, end)

        dates = []
        for offset in range(days):
            day = end - timedelta(days=offset)
            dates.append(
                {
                    "date": day,
                    "editable": dpr.is_day_editable(
                        site,
                        day,
                        today=today,
                        unlocked=unlocked,
                    ),
                    "unlocked_by_admin": day in unlocked,
                    "value": day_values.get(day, Decimal("0")),
                }
            )

        measured = measurement.measured_map(site, start, end)
        items = []
        for row in dpr.build_item_rows(site):
            row["measured"] = {
                d["date"].isoformat(): measured[
                    (row["id"], d["date"])
                ]
                for d in dates
                if (row["id"], d["date"]) in measured
            }
            row["days"] = {
                d["date"].isoformat(): day_qty[
                    (row["id"], d["date"])
                ]
                for d in dates
                if (row["id"], d["date"]) in day_qty
            }
            items.append(row)

        return success_response(
            message="DPR grid retrieved successfully.",
            data={
                "today": today,
                "window": {"start": start, "end": end},
                "edit_window_days": dpr.DPR_EDIT_WINDOW_DAYS,
                "contract_value": dpr.contract_value(site),
                "dates": dates,
                "items": items,
            },
        )

    def put(self, request, *args, **kwargs):
        serializer = GridSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        site = get_site_or_400(
            str(serializer.validated_data["site"])
        )
        site_access.ensure_can_enter(request.user, site)

        edits = serializer.validated_data["edits"]
        if len(edits) > MAX_GRID_EDITS:
            raise ValidationError(
                {"edits": "Too many edits in one save."}
            )
        items = {
            item.id: item
            for item in DprItem.objects.filter(
                site=site,
                id__in={edit["item"] for edit in edits},
            )
        }
        resolved = []
        for edit in edits:
            item = items.get(edit["item"])
            if item is None:
                raise ValidationError(
                    {
                        "edits": (
                            "An item does not belong to this "
                            "site."
                        )
                    }
                )
            resolved.append(
                {
                    "item": item,
                    "date": edit["date"],
                    "qty": edit["qty"],
                }
            )

        result = dpr.save_grid(
            site=site, edits=resolved, actor=request.user
        )
        return success_response(
            message="DPR saved.", data=result
        )


def _entry_row(entry):
    return {
        "id": entry.id,
        "date": entry.date,
        "item": entry.item_id,
        "item_no": entry.item.item_no,
        "description": entry.item.description,
        "unit": entry.item.unit,
        "qty": entry.qty,
        "rate": entry.rate,
        "value": entry.value,
        "location": entry.location,
        "agency": entry.agency,
        "remarks": entry.remarks,
        "source": entry.source,
        "entered_by": (
            entry.created_by.full_name
            if entry.created_by_id
            else ""
        ),
    }


class DprEntryListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        queryset = DprEntry.objects.filter(
            item__site=site
        ).select_related("item", "created_by")
        start = _parse_date(
            request.query_params.get("from"), "from"
        )
        end = _parse_date(
            request.query_params.get("to"), "to"
        )
        if start:
            queryset = queryset.filter(date__gte=start)
        if end:
            queryset = queryset.filter(date__lte=end)
        item_id = request.query_params.get("item")
        if item_id:
            queryset = queryset.filter(item_id=item_id)

        entries = list(queryset[:REGISTER_LIMIT])
        rows = [_entry_row(entry) for entry in entries]
        return success_response(
            message="DPR register retrieved successfully.",
            data={
                "entries": rows,
                "total_value": sum(
                    (row["value"] for row in rows),
                    Decimal("0"),
                ),
                "truncated": queryset.count() > REGISTER_LIMIT,
            },
        )

    def post(self, request, *args, **kwargs):
        serializer = DetailedEntrySerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        site_access.ensure_can_enter(request.user, site)
        try:
            item = DprItem.objects.get(
                pk=data["item"], site=site
            )
        except DprItem.DoesNotExist as exc:
            raise ValidationError(
                {"item": "Item not found for this site."}
            ) from exc

        entry = dpr.add_detailed_entry(
            site=site,
            item=item,
            day=data["date"],
            qty=data["qty"],
            location=data.get("location", ""),
            agency=data.get("agency", ""),
            remarks=data.get("remarks", ""),
            source=DprEntrySource.DETAILED,
            actor=request.user,
        )
        return success_response(
            message="DPR entry added successfully.",
            data={"id": entry.id},
        )


class DprEntryDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            entry = DprEntry.objects.select_related(
                "item", "item__site"
            ).get(pk=pk)
        except DprEntry.DoesNotExist as exc:
            raise NotFound("DPR entry not found.") from exc
        site_access.ensure_can_enter(
            request.user, entry.item.site
        )
        dpr.delete_entry(entry)
        return success_response(
            message="DPR entry deleted successfully.",
            data=None,
        )


class DprUnlockAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        unlocks = DprDayUnlock.objects.filter(
            site=site
        ).select_related("created_by")
        return success_response(
            message="Unlocked days retrieved successfully.",
            data=[
                {
                    "id": unlock.id,
                    "date": unlock.date,
                    "reason": unlock.reason,
                    "unlocked_by": (
                        unlock.created_by.full_name
                        if unlock.created_by_id
                        else ""
                    ),
                }
                for unlock in unlocks
            ],
        )

    def post(self, request, *args, **kwargs):
        if not site_access.can_unlock_days(request.user):
            raise PermissionDenied(
                "Only an Admin can unlock a locked day."
            )
        serializer = UnlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        unlock = dpr.unlock_day(
            site=site,
            day=data["date"],
            reason=data["reason"],
            actor=request.user,
        )
        return success_response(
            message="Day unlocked.",
            data={"id": unlock.id, "date": unlock.date},
        )


class RaBillListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        return success_response(
            message="RA bills retrieved successfully.",
            data=billing.bill_rows(site),
        )

    def post(self, request, *args, **kwargs):
        serializer = BillCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        site_access.ensure_can_enter(request.user, site)

        items = {
            item.id: item
            for item in DprItem.objects.filter(
                site=site,
                id__in={line["item"] for line in data["lines"]},
            )
        }
        lines = []
        for line in data["lines"]:
            item = items.get(line["item"])
            if item is None:
                raise ValidationError(
                    {
                        "lines": (
                            "An item does not belong to this "
                            "site."
                        )
                    }
                )
            lines.append({"item": item, "qty": line["qty"]})

        bill = billing.create_bill(
            site=site,
            bill_no=data["bill_no"],
            bill_date=data["bill_date"],
            lines=lines,
            kind=data["kind"],
            amount=data.get("amount"),
            received_amount=data.get("received_amount"),
            received_on=data.get("received_on"),
            remarks=data.get("remarks", ""),
            actor=request.user,
        )
        return success_response(
            message="RA bill added successfully.",
            data={"id": bill.id},
        )


class RaBillDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    @staticmethod
    def _get_bill(pk):
        try:
            return RaBill.objects.select_related("site").get(
                pk=pk
            )
        except RaBill.DoesNotExist as exc:
            raise NotFound("RA bill not found.") from exc

    def patch(self, request, pk, *args, **kwargs):
        bill = self._get_bill(pk)
        site_access.ensure_can_enter(request.user, bill.site)
        serializer = BillReceiptSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        billing.update_receipt(
            bill,
            received_amount=data.get(
                "received_amount", bill.received_amount
            ),
            received_on=data.get(
                "received_on", bill.received_on
            ),
            remarks=data.get("remarks"),
            actor=request.user,
        )
        return success_response(
            message="RA bill updated successfully.",
            data={"id": bill.id},
        )

    def delete(self, request, pk, *args, **kwargs):
        bill = self._get_bill(pk)
        site_access.ensure_can_enter(request.user, bill.site)
        bill.delete()
        return success_response(
            message="RA bill deleted successfully.",
            data=None,
        )


class FinancialSummaryAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        return success_response(
            message="Financial summary retrieved successfully.",
            data=contract_finance.financial_summary(site),
        )


class FinancialReportAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        as_on = _parse_date(
            request.query_params.get("as_on"), "as_on"
        )
        return success_response(
            message="Financial report retrieved successfully.",
            data=contract_finance.financial_report(
                site, as_on
            ),
        )


def _escalation_row(escalation):
    return {
        "id": escalation.id,
        "effective_from": escalation.effective_from,
        "percent": escalation.percent,
        "note": escalation.note,
    }


class DprEscalationListCreateAPIView(APIView):
    """Dated escalation steps on the contract bid rates."""

    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        rows = RateEscalation.objects.filter(
            site=site
        ).order_by("effective_from")
        return success_response(
            message="Escalations retrieved successfully.",
            data=[_escalation_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        serializer = EscalationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        site = _enterable_site(request)
        escalation = boq.create_escalation(
            site=site,
            actor=request.user,
            effective_from=serializer.validated_data[
                "effective_from"
            ],
            percent=serializer.validated_data["percent"],
            note=serializer.validated_data.get("note", ""),
        )
        return success_response(
            message="Escalation added successfully.",
            data=_escalation_row(escalation),
        )


class DprEscalationDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            escalation = RateEscalation.objects.select_related(
                "site"
            ).get(pk=pk)
        except RateEscalation.DoesNotExist as exc:
            raise NotFound("Escalation not found.") from exc
        site_access.ensure_can_enter(
            request.user, escalation.site
        )
        boq.delete_escalation(escalation)
        return success_response(
            message="Escalation deleted successfully.",
            data=None,
        )


MEASUREMENT_SHEET_LIMIT = 500


def _measurement_line(line):
    return {
        "id": line.id,
        "description": line.description,
        "nos": line.nos,
        "length": line.length,
        "breadth": line.breadth,
        "depth": line.depth,
        "is_deduction": line.is_deduction,
        "remarks": line.remarks,
        "quantity": line.quantity,
    }


def _measurement_sheet(sheet):
    return {
        "item": sheet["item"],
        "date": sheet["date"],
        "total": sheet["total"],
        "lines": [
            _measurement_line(line) for line in sheet["lines"]
        ],
    }


class DprMeasurementAPIView(APIView):
    """
    The measurement lines behind DPR quantities. ``GET`` filters by
    ``item``, ``date`` or a ``from`` / ``to`` range; ``PUT`` replaces
    one item-day's lines (an empty list clears them).
    """

    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        item = None
        if request.query_params.get("item"):
            item = DprItem.objects.filter(
                site=site, pk=request.query_params["item"]
            ).first()
            if item is None:
                raise NotFound("DPR item not found.")
        sheets = measurement.sheet_rows(
            site,
            item=item,
            day=_parse_date(
                request.query_params.get("date"), "date"
            ),
            start=_parse_date(
                request.query_params.get("from"), "from"
            ),
            end=_parse_date(
                request.query_params.get("to"), "to"
            ),
        )[:MEASUREMENT_SHEET_LIMIT]
        return success_response(
            message="Measurements retrieved successfully.",
            data=[_measurement_sheet(sheet) for sheet in sheets],
        )

    def put(self, request, *args, **kwargs):
        serializer = MeasurementSheetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        site_access.ensure_can_enter(request.user, site)
        item = DprItem.objects.filter(
            site=site, pk=data["item"]
        ).first()
        if item is None:
            raise NotFound("DPR item not found.")
        sheet = measurement.replace_sheet(
            site=site,
            item=item,
            day=data["date"],
            lines=data["lines"],
            actor=request.user,
        )
        return success_response(
            message="Measurements saved.",
            data=_measurement_sheet(sheet),
        )
