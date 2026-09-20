from django.db.models import ProtectedError
from django.http import HttpResponse
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
    HasFinanceRoleAccess,
)
from apps.project_monitor.models import (
    FuelEntry,
    HireBasis,
    Machine,
    MachineSource,
    MachineUsage,
)
from apps.project_monitor.services import (
    hr,
    machinery,
    machinery_import,
    site_access,
)

REGISTER_LIMIT = 2000
XLSX_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "spreadsheetml.sheet"
)


class MachineWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    reg_no = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    source = serializers.ChoiceField(
        choices=MachineSource.choices, required=False
    )
    agency = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    hire_basis = serializers.ChoiceField(
        choices=HireBasis.choices, required=False
    )
    rate = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    is_active = serializers.BooleanField(required=False)


class MachineCreateSerializer(MachineWriteSerializer):
    site = serializers.UUIDField()


class MachineUpdateSerializer(MachineWriteSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False


class UsageWriteSerializer(serializers.Serializer):
    machine = serializers.UUIDField()
    date = serializers.DateField()
    qty = serializers.DecimalField(
        max_digits=8,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    hire_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    maintenance = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    other = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class FuelWriteSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    machine = serializers.UUIDField(
        required=False, allow_null=True
    )
    date = serializers.DateField()
    litres = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0
    )
    rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


def _site(request):
    source = request.query_params.get(
        "site"
    ) or request.data.get("site")
    return get_site_or_400(source)


def _viewable_site(request):
    site = _site(request)
    site_access.ensure_can_view_machinery(request.user, site)
    return site


def _enterable_site(request):
    site = _site(request)
    site_access.ensure_can_enter_machinery(request.user, site)
    return site


def _month_range(request):
    year, month = hr.parse_month(
        request.query_params.get("month")
    )
    return year, month, *hr.month_bounds(year, month)


def _machine_row(machine):
    return {
        "id": machine.id,
        "name": machine.name,
        "reg_no": machine.reg_no,
        "source": machine.source,
        "agency": machine.agency,
        "hire_basis": machine.hire_basis,
        "rate": machine.rate,
        "is_active": machine.is_active,
        "needs_review": machine.needs_review,
    }


def _usage_row(usage):
    return {
        "id": usage.id,
        "machine": usage.machine_id,
        "machine_name": usage.machine.name,
        "source": usage.machine.source,
        "date": usage.date,
        "qty": usage.qty,
        "hire_amount": usage.hire_amount,
        "maintenance": usage.maintenance,
        "other": usage.other,
        "remarks": usage.remarks,
        "entry_source": usage.source,
    }


def _fuel_row(entry):
    return {
        "id": entry.id,
        "machine": entry.machine_id,
        "machine_name": (
            entry.machine.name if entry.machine else ""
        ),
        "date": entry.date,
        "litres": entry.litres,
        "rate": entry.rate,
        "amount": entry.amount,
        "remarks": entry.remarks,
    }


def _get_machine(pk):
    try:
        return Machine.objects.select_related("site").get(pk=pk)
    except (Machine.DoesNotExist, ValueError) as exc:
        raise NotFound("Machine not found.") from exc


class MachineryAccessAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        return success_response(
            message="Access retrieved successfully.",
            data={
                "can_view": site_access.can_view_machinery(
                    request.user, site
                ),
                "can_enter": site_access.can_enter_machinery(
                    request.user, site
                ),
            },
        )


class MachinerySummaryAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        year, month, _, _ = _month_range(request)
        return success_response(
            message="Machinery summary retrieved successfully.",
            data=machinery.month_summary(site, year, month),
        )


class MachineListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        return success_response(
            message="Machines retrieved successfully.",
            data=[
                _machine_row(machine)
                for machine in Machine.objects.filter(site=site)
            ],
        )

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = MachineCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            key: value
            for key, value in serializer.validated_data.items()
            if key != "site"
        }
        if Machine.objects.filter(
            site=site,
            name__iexact=data["name"],
            reg_no=data.get("reg_no", ""),
        ).exists():
            raise ValidationError(
                {"name": "This machine is already registered."}
            )
        machine = Machine.objects.create(
            site=site,
            created_by=request.user,
            updated_by=request.user,
            **data,
        )
        return success_response(
            message="Machine added successfully.",
            data=_machine_row(machine),
        )


class MachineDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def patch(self, request, pk, *args, **kwargs):
        machine = _get_machine(pk)
        site_access.ensure_can_enter_machinery(
            request.user, machine.site
        )
        serializer = MachineUpdateSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(machine, field, value)
        # Filling in the details of an upload-created machine is the
        # review the flag asks for.
        if machine.needs_review and (
            "rate" in serializer.validated_data
            or "hire_basis" in serializer.validated_data
        ):
            machine.needs_review = False
        machine.updated_by = request.user
        with as_drf_validation():
            machine.save()
        return success_response(
            message="Machine updated successfully.",
            data=_machine_row(machine),
        )

    def delete(self, request, pk, *args, **kwargs):
        machine = _get_machine(pk)
        site_access.ensure_can_enter_machinery(
            request.user, machine.site
        )
        try:
            machine.delete()
        except ProtectedError as exc:
            raise ValidationError(
                {
                    "detail": (
                        "This machine has usage or fuel "
                        "recorded and cannot be deleted - "
                        "mark it inactive instead."
                    )
                }
            ) from exc
        return success_response(
            message="Machine deleted successfully.", data=None
        )


class UsageListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        _, _, start, end = _month_range(request)
        rows = MachineUsage.objects.filter(
            machine__site=site, date__range=(start, end)
        ).select_related("machine")[:REGISTER_LIMIT]
        return success_response(
            message="Machine usage retrieved successfully.",
            data=[_usage_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        serializer = UsageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        machine = _get_machine(data["machine"])
        site_access.ensure_can_enter_machinery(
            request.user, machine.site
        )
        usage, created = machinery.save_usage(
            machine=machine,
            day=data["date"],
            qty=data.get("qty", 0),
            hire_amount=data.get("hire_amount"),
            maintenance=data.get("maintenance", 0),
            other=data.get("other", 0),
            remarks=data.get("remarks", ""),
            actor=request.user,
        )
        return success_response(
            message=(
                "Machine day saved successfully."
                if created
                else "Machine day updated successfully."
            ),
            data=_usage_row(usage),
        )


class UsageDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            usage = MachineUsage.objects.select_related(
                "machine__site"
            ).get(pk=pk)
        except (MachineUsage.DoesNotExist, ValueError) as exc:
            raise NotFound("Machine day not found.") from exc
        site_access.ensure_can_enter_machinery(
            request.user, usage.machine.site
        )
        usage.delete()
        return success_response(
            message="Machine day deleted successfully.",
            data=None,
        )


class FuelListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        _, _, start, end = _month_range(request)
        rows = FuelEntry.objects.filter(
            site=site, date__range=(start, end)
        ).select_related("machine")[:REGISTER_LIMIT]
        return success_response(
            message="Fuel entries retrieved successfully.",
            data=[_fuel_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = FuelWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        machine = (
            _get_machine(data["machine"])
            if data.get("machine")
            else None
        )
        entry = machinery.add_fuel(
            site=site,
            machine=machine,
            day=data["date"],
            litres=data["litres"],
            rate=data.get("rate"),
            amount=data.get("amount"),
            remarks=data.get("remarks", ""),
            actor=request.user,
        )
        return success_response(
            message="Fuel entry added successfully.",
            data=_fuel_row(entry),
        )


class FuelDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            entry = FuelEntry.objects.select_related(
                "site"
            ).get(pk=pk)
        except (FuelEntry.DoesNotExist, ValueError) as exc:
            raise NotFound("Fuel entry not found.") from exc
        site_access.ensure_can_enter_machinery(
            request.user, entry.site
        )
        entry.delete()
        return success_response(
            message="Fuel entry deleted successfully.",
            data=None,
        )


class MachineryTemplateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = None
        if request.query_params.get("site"):
            site = _enterable_site(request)
        response = HttpResponse(
            machinery_import.build_template(site),
            content_type=XLSX_TYPE,
        )
        response["Content-Disposition"] = (
            'attachment; filename="machinery-upload-template.xlsx"'
        )
        return response


class MachineryUploadAPIView(APIView):
    """
    Bulk upload, routed by site code (each row checked against the
    caller's Machinery assignment). ``site`` is the default for blank
    rows.
    """

    permission_classes = [HasFinanceRoleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        default_site = None
        if request.data.get("site"):
            default_site = _enterable_site(request)
        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise serializers.ValidationError(
                {"file": "Choose a file to upload."}
            )
        result = machinery_import.import_machinery(
            uploaded,
            request.user,
            default_site=default_site,
        )
        return success_response(
            message="Machinery file processed.", data=result
        )
