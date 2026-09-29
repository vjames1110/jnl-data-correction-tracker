from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import (
    NotFound,
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
    HasProjectMonitorCostingAccess,
)
from apps.project_monitor.models import (
    ConcreteProduction,
    CostingBoqItem,
    DprItem,
    MaterialKind,
    MaterialRate,
)
from apps.project_monitor.services import (
    costing,
    costing_boq,
    costing_boq_import,
    project_scope,
)

XLSX_TYPE = (
    "application/vnd.openxmlformats-officedocument"
    ".spreadsheetml.sheet"
)


class RateWriteSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    kind = serializers.ChoiceField(
        choices=MaterialKind.choices
    )
    effective_from = serializers.DateField()
    rate = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0
    )


class ProductionWriteSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    date = serializers.DateField()
    grade = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    cum = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=0
    )
    cement_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    aggregate_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    sand_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    other_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


def _rate_row(rate):
    return {
        "id": rate.id,
        "kind": rate.kind,
        "effective_from": rate.effective_from,
        "rate": rate.rate,
    }


def _production_row(row):
    return {
        "id": row.id,
        "date": row.date,
        "grade": row.grade,
        "cum": row.cum,
        "cement_cost": row.cement_cost,
        "aggregate_cost": row.aggregate_cost,
        "sand_cost": row.sand_cost,
        "other_cost": row.other_cost,
        "total_cost": row.total_cost,
        "remarks": row.remarks,
    }


def _parse_date(raw, field):
    try:
        return serializers.DateField().to_internal_value(
            raw
        )
    except serializers.ValidationError as exc:
        raise ValidationError(
            {field: "Use the format YYYY-MM-DD."}
        ) from exc


def _range(request):
    today = timezone.localdate()
    raw_to = request.query_params.get("to")
    raw_from = request.query_params.get("from")
    end = (
        _parse_date(raw_to, "to") if raw_to else today
    )
    start = (
        _parse_date(raw_from, "from")
        if raw_from
        else end
        - timedelta(days=costing.DEFAULT_RANGE_DAYS - 1)
    )
    if start > end:
        raise ValidationError(
            {
                "from": (
                    "The start date must be on or "
                    "before the end date."
                )
            }
        )
    return start, end


class CostingAccessAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        return success_response(
            message="Access retrieved successfully.",
            data={
                "can_enter": request.user.role
                in project_scope.ADMIN_ROLES,
            },
        )


class CostingGlanceAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        raw_on = request.query_params.get("on")
        return success_response(
            message=(
                "Today at a glance retrieved successfully."
            ),
            data=costing.today_at_a_glance(
                site,
                period=request.query_params.get(
                    "period", "today"
                ),
                on=_parse_date(raw_on, "on")
                if raw_on
                else None,
            ),
        )


class CostingTableAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        start, end = _range(request)
        return success_response(
            message="Cost table retrieved successfully.",
            data=costing.cost_table(site, start, end),
        )


class MaterialRateListCreateAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        rows = costing.rate_register(site)
        return success_response(
            message=(
                "Material rates retrieved successfully."
            ),
            data=[_rate_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        serializer = RateWriteSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        rate = costing.create_rate(
            site=site,
            kind=data["kind"],
            effective_from=data["effective_from"],
            rate=data["rate"],
            actor=request.user,
        )
        return success_response(
            message="Material rate added successfully.",
            data=_rate_row(rate),
        )


class MaterialRateDetailAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            rate = MaterialRate.objects.get(pk=pk)
        except (
            MaterialRate.DoesNotExist,
            ValueError,
        ) as exc:
            raise NotFound(
                "Material rate not found."
            ) from exc
        costing.delete_rate(rate)
        return success_response(
            message="Material rate deleted successfully.",
            data=None,
        )


class ConcreteProductionListCreateAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        start, end = _range(request)
        rows = costing.production_register(
            site, start, end
        )
        return success_response(
            message=(
                "Concrete production retrieved "
                "successfully."
            ),
            data=[_production_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        serializer = ProductionWriteSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        site = get_site_or_400(str(data["site"]))
        row = costing.create_production(
            site=site,
            day=data["date"],
            grade=data.get("grade", ""),
            cum=data["cum"],
            cement_cost=data.get("cement_cost", 0),
            aggregate_cost=data.get(
                "aggregate_cost", 0
            ),
            sand_cost=data.get("sand_cost", 0),
            other_cost=data.get("other_cost", 0),
            remarks=data.get("remarks", ""),
            actor=request.user,
        )
        return success_response(
            message=(
                "Concrete production recorded "
                "successfully."
            ),
            data=_production_row(row),
        )


class ConcreteProductionDetailAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            row = ConcreteProduction.objects.get(pk=pk)
        except (
            ConcreteProduction.DoesNotExist,
            ValueError,
        ) as exc:
            raise NotFound(
                "Concrete production entry not found."
            ) from exc
        costing.delete_production(row)
        return success_response(
            message=(
                "Concrete production entry deleted "
                "successfully."
            ),
            data=None,
        )


class ItemLinkWriteSerializer(serializers.Serializer):
    concrete_per_unit = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=0
    )
    tmt_kg_per_unit = serializers.DecimalField(
        max_digits=10, decimal_places=3, min_value=0
    )


class ItemLinkListAPIView(APIView):
    """DPR items with their material consumption and the rates in force."""

    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        return success_response(
            message="Item links retrieved successfully.",
            data=costing.item_links(site),
        )


class ItemLinkDetailAPIView(APIView):
    """Set one DPR item's concrete and TMT use per unit (Admin)."""

    permission_classes = [HasProjectMonitorCostingAccess]

    def patch(self, request, pk, *args, **kwargs):
        try:
            item = DprItem.objects.select_related("site").get(
                pk=pk
            )
        except (DprItem.DoesNotExist, ValueError) as exc:
            raise NotFound("DPR item not found.") from exc
        serializer = ItemLinkWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        costing.set_item_link(
            item=item,
            actor=request.user,
            **serializer.validated_data,
        )
        links = costing.item_links(item.site)
        row = next(
            row for row in links["items"] if row["id"] == item.id
        )
        return success_response(
            message="Item link saved successfully.", data=row
        )


class CostingBoqItemWriteSerializer(serializers.Serializer):
    parent_id = serializers.UUIDField(
        required=False, allow_null=True
    )
    item_no = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    description = serializers.CharField(max_length=300)
    unit = serializers.CharField(
        max_length=30, required=False, allow_blank=True
    )
    qty = serializers.DecimalField(
        max_digits=14,
        decimal_places=3,
        required=False,
        allow_null=True,
        min_value=0,
    )
    authority_rate = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    tender_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    rate = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    our_cost_rate = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    gst_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    is_active = serializers.BooleanField(required=False)


class CostingContractSettingsSerializer(serializers.Serializer):
    tender_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    authority_escalation_percent = serializers.DecimalField(
        max_digits=7,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    gst_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )


class CostingContractSettingsAPIView(APIView):
    """
    The three contract-wide settings the costing BOQ reads: the
    tender percentage (shared with DPR & Bills' own BOQ), the
    departmental escalation on the authority rate, and the default
    GST %. Changing the tender % or the escalation re-derives every
    row's bid rate - see ``costing_boq.recalculate_rates``.
    """

    permission_classes = [HasProjectMonitorCostingAccess]

    @staticmethod
    def _payload(site):
        return {
            "tender_percent": site.tender_percent,
            "authority_escalation_percent": (
                site.authority_escalation_percent
            ),
            "gst_percent": site.gst_percent,
        }

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        return success_response(
            message=(
                "Contract settings retrieved successfully."
            ),
            data=self._payload(site),
        )

    def patch(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        serializer = CostingContractSettingsSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        recalculate = any(
            field in serializer.validated_data
            and serializer.validated_data[field]
            != getattr(site, field)
            for field in (
                "tender_percent",
                "authority_escalation_percent",
            )
        )
        for field, value in serializer.validated_data.items():
            setattr(site, field, value)
        with as_drf_validation():
            site.save()
        payload = self._payload(site)
        if recalculate:
            payload["recalculated"] = (
                costing_boq.recalculate_rates(
                    site, actor=request.user
                )
            )
        return success_response(
            message="Contract settings updated successfully.",
            data=payload,
        )


def _boq_item_or_404(pk):
    try:
        return CostingBoqItem.objects.select_related("site").get(
            pk=pk
        )
    except (CostingBoqItem.DoesNotExist, ValueError) as exc:
        raise NotFound("BOQ item not found.") from exc


class CostingBoqSheetAPIView(APIView):
    """
    The costing-native BOQ replacing DPR & Bills as the place profit
    and loss is worked out (see ``CostingBoqItem``): every row with
    its authority/bid/our-cost rates and profit/loss, plus the
    contract-wide totals (GET), or a new row (POST).
    """

    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        return success_response(
            message="BOQ retrieved successfully.",
            data=costing_boq.boq_sheet(site),
        )

    def post(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        serializer = CostingBoqItemWriteSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        parent_id = data.pop("parent_id", None)
        parent = (
            _boq_item_or_404(parent_id) if parent_id else None
        )
        item = costing_boq.create_item(
            site=site,
            parent=parent,
            actor=request.user,
            **data,
        )
        return success_response(
            message="BOQ item added successfully.",
            data={"id": item.id},
        )


class CostingBoqItemDetailAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def patch(self, request, pk, *args, **kwargs):
        item = _boq_item_or_404(pk)
        serializer = CostingBoqItemWriteSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if "parent_id" in data:
            parent_id = data.pop("parent_id")
            item.parent = (
                _boq_item_or_404(parent_id)
                if parent_id
                else None
            )
        costing_boq.update_item(
            item, actor=request.user, **data
        )
        return success_response(
            message="BOQ item updated successfully.",
            data={"id": item.id},
        )

    def delete(self, request, pk, *args, **kwargs):
        item = _boq_item_or_404(pk)
        costing_boq.delete_item(item)
        return success_response(
            message="BOQ item deleted successfully.",
            data=None,
        )


class CostingBoqImportAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "Choose a file."})
        result = costing_boq_import.import_items(
            site, upload, actor=request.user
        )
        return success_response(
            message="BOQ imported.", data=result
        )


class CostingBoqTemplateAPIView(APIView):
    permission_classes = [HasProjectMonitorCostingAccess]

    def get(self, request, *args, **kwargs):
        content = costing_boq_import.build_template()
        response = HttpResponse(
            content, content_type=XLSX_TYPE
        )
        response["Content-Disposition"] = (
            'attachment; filename="costing-boq-template.xlsx"'
        )
        return response
