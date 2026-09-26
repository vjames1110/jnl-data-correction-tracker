from datetime import date

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
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
    LabourEntry,
    StaffDayOverride,
    StaffMember,
)
from apps.project_monitor.services import (
    hr,
    hr_bulk_import,
    hr_import,
    site_access,
)

REGISTER_LIMIT = 2000
XLSX_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "spreadsheetml.sheet"
)


class LabourWriteSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    date = serializers.DateField()
    category = serializers.CharField(max_length=100)
    nos = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0
    )
    rate = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        min_value=0,
    )
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        min_value=0,
    )
    agency = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )
    remarks = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


class StaffWriteSerializer(serializers.Serializer):
    staff_code = serializers.CharField(
        max_length=50, required=False, allow_blank=True
    )
    name = serializers.CharField(max_length=150)
    designation = serializers.CharField(
        max_length=100, required=False, allow_blank=True
    )
    monthly_salary = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0
    )
    from_date = serializers.DateField()
    to_date = serializers.DateField(
        required=False, allow_null=True
    )


class StaffCreateSerializer(StaffWriteSerializer):
    site = serializers.UUIDField()


class StaffUpdateSerializer(StaffWriteSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.required = False


class OverrideWriteSerializer(serializers.Serializer):
    staff = serializers.UUIDField()
    date = serializers.DateField()
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0
    )
    note = serializers.CharField(
        max_length=300, required=False, allow_blank=True
    )


def _site(request):
    source = request.query_params.get(
        "site"
    ) or request.data.get("site")
    return get_site_or_400(source)


def _viewable_site(request):
    site = _site(request)
    site_access.ensure_can_view_hr(request.user, site)
    return site


def _enterable_site(request):
    site = _site(request)
    site_access.ensure_can_enter_hr(request.user, site)
    return site


def _month_range(request):
    year, month = hr.parse_month(
        request.query_params.get("month")
    )
    return year, month, *hr.month_bounds(year, month)


def _labour_row(entry):
    return {
        "id": entry.id,
        "date": entry.date,
        "category": entry.category,
        "nos": entry.nos,
        "rate": entry.rate,
        "amount": entry.amount,
        "agency": entry.agency,
        "remarks": entry.remarks,
        "source": entry.source,
    }


def _staff_row(member, today):
    return {
        "id": member.id,
        "staff_code": member.staff_code,
        "name": member.name,
        "designation": member.designation,
        "monthly_salary": member.monthly_salary,
        "from_date": member.from_date,
        "to_date": member.to_date,
        "on_payroll_today": hr.is_on_payroll(member, today),
        "daily_rate_today": hr.daily_rate(member, today),
    }


def _override_row(row):
    return {
        "id": row.id,
        "staff": row.staff_id,
        "staff_name": row.staff.name,
        "date": row.date,
        "amount": row.amount,
        "note": row.note,
    }


class HrAccessAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(
            request.query_params.get("site")
        )
        return success_response(
            message="Access retrieved successfully.",
            data={
                "can_view": site_access.can_view_hr(
                    request.user, site
                ),
                "can_enter": site_access.can_enter_hr(
                    request.user, site
                ),
            },
        )


class HrSummaryAPIView(APIView):
    """Day-wise HR cost for a month (future days skipped)."""

    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        year, month, _, _ = _month_range(request)
        return success_response(
            message="HR summary retrieved successfully.",
            data=hr.month_summary(site, year, month),
        )


class HrLabourListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        _, _, start, end = _month_range(request)
        entries = hr.labour_register(site, start, end)[
            :REGISTER_LIMIT
        ]
        return success_response(
            message="Labour entries retrieved successfully.",
            data=[_labour_row(entry) for entry in entries],
        )

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = LabourWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        entry = hr.create_labour(
            site=site,
            day=data["date"],
            category=data["category"],
            nos=data["nos"],
            rate=data.get("rate"),
            amount=data.get("amount"),
            agency=data.get("agency", ""),
            remarks=data.get("remarks", ""),
            actor=request.user,
        )
        return success_response(
            message="Labour entry added successfully.",
            data=_labour_row(entry),
        )


class HrLabourDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            entry = LabourEntry.objects.select_related(
                "site"
            ).get(pk=pk)
        except (LabourEntry.DoesNotExist, ValueError) as exc:
            raise NotFound("Labour entry not found.") from exc
        site_access.ensure_can_enter_hr(
            request.user, entry.site
        )
        entry.delete()
        return success_response(
            message="Labour entry deleted successfully.",
            data=None,
        )


class HrStaffListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        today = timezone.localdate()
        return success_response(
            message="Staff retrieved successfully.",
            data=[
                _staff_row(member, today)
                for member in StaffMember.objects.filter(
                    site=site
                )
            ],
        )

    def post(self, request, *args, **kwargs):
        site = _enterable_site(request)
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            key: value
            for key, value in serializer.validated_data.items()
            if key != "site"
        }
        member = StaffMember(
            site=site,
            created_by=request.user,
            updated_by=request.user,
            **data,
        )
        with as_drf_validation():
            member.full_clean()
        member.save()
        return success_response(
            message="Staff member added successfully.",
            data=_staff_row(member, timezone.localdate()),
        )


class HrStaffDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    @staticmethod
    def _get(request, pk):
        try:
            member = StaffMember.objects.select_related(
                "site"
            ).get(pk=pk)
        except (StaffMember.DoesNotExist, ValueError) as exc:
            raise NotFound("Staff member not found.") from exc
        site_access.ensure_can_enter_hr(
            request.user, member.site
        )
        return member

    def patch(self, request, pk, *args, **kwargs):
        member = self._get(request, pk)
        serializer = StaffUpdateSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(member, field, value)
        member.updated_by = request.user
        with as_drf_validation():
            member.full_clean()
        member.save()
        return success_response(
            message="Staff member updated successfully.",
            data=_staff_row(member, timezone.localdate()),
        )

    def delete(self, request, pk, *args, **kwargs):
        self._get(request, pk).delete()
        return success_response(
            message="Staff member deleted successfully.",
            data=None,
        )


class HrOverrideListCreateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = _viewable_site(request)
        _, _, start, end = _month_range(request)
        rows = StaffDayOverride.objects.filter(
            staff__site=site, date__range=(start, end)
        ).select_related("staff")
        return success_response(
            message="Day overrides retrieved successfully.",
            data=[_override_row(row) for row in rows],
        )

    def post(self, request, *args, **kwargs):
        serializer = OverrideWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            member = StaffMember.objects.select_related(
                "site"
            ).get(pk=data["staff"])
        except StaffMember.DoesNotExist as exc:
            raise NotFound("Staff member not found.") from exc
        site_access.ensure_can_enter_hr(
            request.user, member.site
        )
        row, _ = hr.set_override(
            staff=member,
            day=data["date"],
            amount=data["amount"],
            note=data.get("note", ""),
            actor=request.user,
        )
        return success_response(
            message="Day cost saved successfully.",
            data=_override_row(row),
        )


class HrOverrideDetailAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def delete(self, request, pk, *args, **kwargs):
        try:
            row = StaffDayOverride.objects.select_related(
                "staff__site"
            ).get(pk=pk)
        except (
            StaffDayOverride.DoesNotExist,
            ValueError,
        ) as exc:
            raise NotFound("Day cost not found.") from exc
        site_access.ensure_can_enter_hr(
            request.user, row.staff.site
        )
        row.delete()
        return success_response(
            message="Day cost cleared successfully.",
            data=None,
        )


class HrTemplateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        site = None
        if request.query_params.get("site"):
            site = _enterable_site(request)
        response = HttpResponse(
            hr_import.build_template(site),
            content_type=XLSX_TYPE,
        )
        response["Content-Disposition"] = (
            'attachment; filename="hr-upload-template.xlsx"'
        )
        return response


class HrUploadAPIView(APIView):
    """
    Bulk upload. Rows are routed by site code, so one file can cover
    several projects; each row is checked against the caller's HR
    assignment. ``site`` (optional) is the default for blank rows.
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
        result = hr_import.import_hr(
            uploaded,
            request.user,
            default_site=default_site,
        )
        return success_response(
            message="HR file processed.", data=result
        )


def _optional_enterable_site(request):
    """The default site for blank rows, when one is chosen."""
    if request.query_params.get("site") or request.data.get("site"):
        return _enterable_site(request)
    return None


def _uploaded_file(request):
    uploaded = request.FILES.get("file")
    if uploaded is None:
        raise serializers.ValidationError(
            {"file": "Choose a file to upload."}
        )
    return uploaded


def _xlsx_response(content, filename):
    response = HttpResponse(content, content_type=XLSX_TYPE)
    response["Content-Disposition"] = (
        f'attachment; filename="{filename}"'
    )
    return response


class HrStaffTemplateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        return _xlsx_response(
            hr_bulk_import.build_staff_template(
                _optional_enterable_site(request)
            ),
            "hr-staff-register-template.xlsx",
        )


class HrStaffUploadAPIView(APIView):
    """
    Staff register for many sites in one file: each row goes to its
    own site by site code, is added or left as it is, and a different
    salary is refused unless the row carries an Effective from date.
    Every row is checked against the caller's HR right for its site.
    """

    permission_classes = [HasFinanceRoleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        result = hr_bulk_import.import_staff_register(
            _uploaded_file(request),
            request.user,
            default_site=_optional_enterable_site(request),
        )
        return success_response(
            message="Staff register file processed.",
            data=result,
        )


class HrMusterTemplateAPIView(APIView):
    permission_classes = [HasFinanceRoleAccess]

    def get(self, request, *args, **kwargs):
        kind = (
            "grid"
            if request.query_params.get("layout") == "grid"
            else "flat"
        )
        return _xlsx_response(
            hr_bulk_import.build_muster_template(
                kind=kind,
                month=request.query_params.get("month"),
                site=_optional_enterable_site(request),
            ),
            f"hr-muster-{kind}-template.xlsx",
        )


class HrMusterUploadAPIView(APIView):
    """
    The muster (attendance) for many sites in one file, either as one
    row per person per day or as a month grid. Absent and half days
    become that day's staff cost; re-uploading changes nothing.
    ``month`` (YYYY-MM) names the month for a grid numbered 1-31.
    """

    permission_classes = [HasFinanceRoleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        result = hr_bulk_import.import_muster(
            _uploaded_file(request),
            request.user,
            default_site=_optional_enterable_site(request),
            month=request.data.get("month") or None,
        )
        return success_response(
            message="Muster file processed.", data=result
        )
