"""
The costing-native BOQ (see ``CostingBoqItem`` / ``services.costing_boq``):
authority rate, bid rate, our cost and profit/loss for every row, with
materials nested as a row's own cost breakdown rather than a separate
mechanism.
"""

import io
from decimal import Decimal

import openpyxl
import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.project_monitor.models import CostingBoqItem
from apps.project_monitor.services import costing_boq, costing_boq_import

D = Decimal
OK = status.HTTP_200_OK
FORBIDDEN = status.HTTP_403_FORBIDDEN
BAD_REQUEST = status.HTTP_400_BAD_REQUEST


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_item(site, **overrides):
    values = {"description": "RCC retaining wall", "unit": "cum"}
    values.update(overrides)
    return costing_boq.create_item(site=site, **values)


# ---------------------------------------------------------------- model


@pytest.mark.django_db
class TestBidRateCalculation:
    def test_escalation_applies_to_the_authority_rate_before_tender_percent(
        self, site
    ):
        site.authority_escalation_percent = D("10")
        site.save()
        item = make_item(
            site, authority_rate=D("1000"), tender_percent=D("-10")
        )

        # 1000 x 1.10 = 1100; 1100 x 0.90 = 990.00.
        assert item.rate == D("990.00")

    def test_falls_back_to_the_contract_wide_tender_percent(self, site):
        site.tender_percent = D("12")
        site.save()
        item = make_item(site, authority_rate=D("500"))

        assert item.rate == D("560.00")

    def test_no_authority_rate_keeps_a_hand_typed_rate(self, site):
        item = make_item(site, rate=D("250"))

        assert item.rate == D("250")

    def test_no_escalation_or_tender_percent_is_a_no_op(self, site):
        item = make_item(site, authority_rate=D("1000"))

        assert item.rate == D("1000.00")


@pytest.mark.django_db
class TestHierarchy:
    def test_a_row_can_go_under_another_of_the_same_site(self, site):
        parent = make_item(site)
        child = make_item(
            site, description="Supply of cement", parent=parent
        )

        assert child.parent_id == parent.id

    def test_a_row_cannot_go_under_one_from_another_site(
        self, site, other_site
    ):
        parent = make_item(other_site)

        with pytest.raises(ValidationError):
            costing_boq.create_item(
                site=site, description="x", parent=parent
            )

    def test_a_row_cannot_become_its_own_ancestor(self, site):
        top = make_item(site, description="Top")
        middle = make_item(site, description="Middle", parent=top)

        top.parent = middle
        with pytest.raises(DjangoValidationError):
            top.save()

    def test_depth_is_capped(self, site):
        node = make_item(site, description="L1")
        for level in range(2, CostingBoqItem.MAX_LEVEL + 1):
            node = make_item(
                site, description=f"L{level}", parent=node
            )

        with pytest.raises(DjangoValidationError):
            make_item(site, description="Too deep", parent=node)

    def test_negative_values_are_refused(self, site):
        with pytest.raises(DjangoValidationError):
            make_item(site, qty=D("-1"))


# -------------------------------------------------------------- service


@pytest.mark.django_db
class TestBuildRows:
    def test_a_leaf_uses_its_own_typed_cost(self, site):
        item = make_item(
            site,
            qty=D("100"),
            authority_rate=D("10000"),
            tender_percent=D("-10"),
            our_cost_rate=D("8000"),
        )

        (row,) = costing_boq.build_rows(site)

        assert row["id"] == item.id
        assert row["bid_rate"] == D("9000.00")
        assert row["bid_amount"] == D("900000.00")
        assert row["our_cost_rate"] == D("8000")
        assert row["cost_amount"] == D("800000.00")
        assert row["profit_per_unit"] == D("1000.00")
        assert row["profit_amount"] == D("100000.00")
        assert row["has_children"] is False

    def test_a_parent_s_cost_is_rolled_up_from_its_materials(self, site):
        wall = make_item(
            site,
            qty=D("100"),
            authority_rate=D("10000"),
            tender_percent=D("-10"),
            our_cost_rate=D("999999"),  # ignored - it has children
        )
        make_item(
            site,
            description="Supply of cement",
            unit="bag",
            qty=D("640"),
            our_cost_rate=D("360"),
            parent=wall,
        )
        make_item(
            site,
            description="Supply of sand",
            unit="cum",
            qty=D("48"),
            our_cost_rate=D("1500"),
            parent=wall,
        )

        rows = {r["description"]: r for r in costing_boq.build_rows(site)}
        wall_row = rows["RCC retaining wall"]

        # 640 x 360 + 48 x 1500 = 230400 + 72000 = 302400.
        assert wall_row["cost_amount"] == D("302400.00")
        assert wall_row["our_cost_rate"] == D("3024.00")
        assert wall_row["bid_amount"] == D("900000.00")
        assert wall_row["profit_amount"] == D("597600.00")
        assert wall_row["has_children"] is True
        assert rows["Supply of cement"]["cost_amount"] == D("230400.00")

    def test_gst_is_shown_separately_and_never_touches_profit(self, site):
        item = make_item(
            site,
            qty=D("10"),
            rate=D("1000"),
            our_cost_rate=D("700"),
            gst_percent=D("18"),
        )

        (row,) = costing_boq.build_rows(site)

        assert row["bid_amount"] == D("10000.00")
        assert row["gst_amount"] == D("1800.00")
        assert row["bid_amount_incl_gst"] == D("11800.00")
        # Profit stays GST-exclusive.
        assert row["profit_amount"] == D("3000.00")

    def test_gst_falls_back_to_the_contract_wide_percent(self, site):
        site.gst_percent = D("18")
        site.save()
        make_item(site, qty=D("1"), rate=D("100"))

        (row,) = costing_boq.build_rows(site)

        assert row["gst_percent"] == D("18")
        assert row["gst_amount"] == D("18.00")

    def test_an_item_with_no_qty_has_a_zero_amount(self, site):
        make_item(site, rate=D("500"))

        (row,) = costing_boq.build_rows(site)

        assert row["bid_amount"] == D("0")
        assert row["profit_amount"] == D("0")

    def test_inactive_rows_are_left_out(self, site):
        item = make_item(site)
        item.is_active = False
        item.save()

        assert costing_boq.build_rows(site) == []

    def test_summary_counts_only_level_one_rows(self, site):
        wall = make_item(
            site, qty=D("10"), rate=D("1000"), our_cost_rate=D("600")
        )
        make_item(
            site,
            description="Supply of cement",
            qty=D("100"),
            rate=D("50"),  # a material's own "bid" - not client revenue
            our_cost_rate=D("40"),
            parent=wall,
        )

        total = costing_boq.summary(costing_boq.build_rows(site))

        # Only the wall's own 10 x 1000 = 10000 counts - the cement's
        # own qty x rate (100 x 50 = 5000) is cost-only, not revenue.
        assert total["bid_amount"] == D("10000.00")


@pytest.mark.django_db
class TestRecalculateRates:
    def test_re_derives_every_item_with_an_authority_rate(self, site):
        item = make_item(
            site, authority_rate=D("1000"), tender_percent=D("-10")
        )
        assert item.rate == D("900.00")
        site.tender_percent = D("-5")
        site.save()

        changed = costing_boq.recalculate_rates(site)

        item.refresh_from_db()
        assert changed == 0  # the item has its own -10%, unaffected
        assert item.rate == D("900.00")

    def test_uses_the_items_own_percent_first(self, site):
        item = make_item(site, authority_rate=D("1000"))  # no override
        assert item.rate == D("1000.00")
        site.tender_percent = D("10")
        site.save()

        changed = costing_boq.recalculate_rates(site)

        item.refresh_from_db()
        assert changed == 1
        assert item.rate == D("1100.00")

    def test_leaves_hand_typed_rates_untouched(self, site):
        item = make_item(site, rate=D("500"))
        site.tender_percent = D("50")
        site.save()

        changed = costing_boq.recalculate_rates(site)

        item.refresh_from_db()
        assert changed == 0
        assert item.rate == D("500")


@pytest.mark.django_db
class TestContractSettingsApi:
    def test_director_and_admin_can_read_and_write(self, site):
        for factory in (DirectorUserFactory, AdminUserFactory):
            client = client_for(factory())
            response = client.patch(
                f"{url('costing-contract-settings')}?site={site.id}",
                {
                    "tender_percent": "-5",
                    "authority_escalation_percent": "3",
                    "gst_percent": "18",
                },
                format="json",
            )
            assert response.status_code == OK, response.data
            site.refresh_from_db()
            assert site.tender_percent == D("-5")
            assert site.authority_escalation_percent == D("3")
            assert site.gst_percent == D("18")

    def test_nobody_else_may_read_or_write(self, site):
        client = client_for(ProjectManagerUserFactory())

        assert (
            client.get(
                f"{url('costing-contract-settings')}?site={site.id}"
            ).status_code
            == FORBIDDEN
        )
        assert (
            client.patch(
                f"{url('costing-contract-settings')}?site={site.id}",
                {"gst_percent": "18"},
                format="json",
            ).status_code
            == FORBIDDEN
        )

    def test_changing_the_tender_percent_recalculates_items(self, site):
        client = client_for(AdminUserFactory())
        item = make_item(site, authority_rate=D("1000"))
        assert item.rate == D("1000.00")

        response = client.patch(
            f"{url('costing-contract-settings')}?site={site.id}",
            {"tender_percent": "10"},
            format="json",
        )

        assert response.status_code == OK, response.data
        assert response.data["data"]["recalculated"] == 1
        item.refresh_from_db()
        assert item.rate == D("1100.00")

    def test_changing_only_gst_does_not_recalculate(self, site):
        client = client_for(AdminUserFactory())
        make_item(site, authority_rate=D("1000"))

        response = client.patch(
            f"{url('costing-contract-settings')}?site={site.id}",
            {"gst_percent": "18"},
            format="json",
        )

        assert response.status_code == OK, response.data
        assert "recalculated" not in response.data["data"]


@pytest.mark.django_db
class TestCrudService:
    def test_deleting_a_row_with_children_is_refused(self, site):
        parent = make_item(site)
        make_item(site, description="child", parent=parent)

        with pytest.raises(ValidationError):
            costing_boq.delete_item(parent)
        assert CostingBoqItem.objects.filter(pk=parent.pk).exists()

    def test_deleting_a_leaf_works(self, site):
        item = make_item(site)

        costing_boq.delete_item(item)

        assert not CostingBoqItem.objects.filter(pk=item.pk).exists()

    def test_update_changes_only_the_given_fields(self, site):
        item = make_item(site, qty=D("10"), rate=D("100"))

        costing_boq.update_item(item, qty=D("20"))

        item.refresh_from_db()
        assert item.qty == D("20")
        assert item.rate == D("100")


# ------------------------------------------------------------------ API


@pytest.mark.django_db
class TestCostingBoqApi:
    def test_director_and_admin_can_read_and_write(self, site):
        for factory in (DirectorUserFactory, AdminUserFactory):
            client = client_for(factory())
            response = client.post(
                f"{url('costing-boq-sheet')}?site={site.id}",
                {"description": "Item", "qty": "10", "rate": "100"},
                format="json",
            )
            assert response.status_code == OK, response.data
            get_response = client.get(
                f"{url('costing-boq-sheet')}?site={site.id}"
            )
            assert get_response.status_code == OK

    @pytest.mark.parametrize(
        "factory", [ProjectManagerUserFactory, UserFactory]
    )
    def test_nobody_else_may_view_or_enter(self, site, factory):
        client = client_for(factory())

        assert (
            client.get(
                f"{url('costing-boq-sheet')}?site={site.id}"
            ).status_code
            == FORBIDDEN
        )
        assert (
            client.post(
                f"{url('costing-boq-sheet')}?site={site.id}",
                {"description": "x"},
                format="json",
            ).status_code
            == FORBIDDEN
        )

    def test_creates_a_row_under_a_parent(self, site):
        client = client_for(AdminUserFactory())
        parent = client.post(
            f"{url('costing-boq-sheet')}?site={site.id}",
            {
                "description": "RCC retaining wall",
                "qty": "100",
                "authority_rate": "10000",
                "tender_percent": "-10",
            },
            format="json",
        ).data["data"]

        response = client.post(
            f"{url('costing-boq-sheet')}?site={site.id}",
            {
                "description": "Supply of cement",
                "qty": "640",
                "our_cost_rate": "360",
                "parent_id": parent["id"],
            },
            format="json",
        )

        assert response.status_code == OK, response.data
        sheet = client.get(
            f"{url('costing-boq-sheet')}?site={site.id}"
        ).data["data"]
        wall = next(
            r for r in sheet["rows"] if r["description"] == "RCC retaining wall"
        )
        assert Decimal(wall["cost_amount"]) == D("230400.00")

    def test_updates_a_row(self, site):
        client = client_for(AdminUserFactory())
        item = make_item(site, qty=D("1"), rate=D("100"))

        response = client.patch(
            url("costing-boq-detail", item.id),
            {"qty": "5"},
            format="json",
        )

        assert response.status_code == OK, response.data
        item.refresh_from_db()
        assert item.qty == D("5")

    def test_deletes_a_leaf_but_refuses_a_row_with_children(self, site):
        client = client_for(AdminUserFactory())
        parent = make_item(site)
        make_item(site, description="child", parent=parent)

        refused = client.delete(url("costing-boq-detail", parent.id))
        assert refused.status_code == BAD_REQUEST
        deleted = client.delete(
            url(
                "costing-boq-detail",
                CostingBoqItem.objects.get(description="child").id,
            )
        )
        assert deleted.status_code == OK

    def test_an_unknown_row_is_a_404(self, site):
        client = client_for(AdminUserFactory())

        response = client.patch(
            url(
                "costing-boq-detail",
                "00000000-0000-0000-0000-000000000000",
            ),
            {"qty": "1"},
            format="json",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


# -------------------------------------------------------------- import


def xlsx_upload(rows, name="boq.xlsx"):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(name, buffer.getvalue())


BOQ_HEADER = [
    "Item no",
    "Description",
    "Unit",
    "Qty",
    "Authority rate",
    "Tender/Awarded %",
    "Quoted/Bid rate",
    "Our cost (Actual costing at site)",
    "GST %",
]


@pytest.mark.django_db
class TestImport:
    def test_imports_a_group_and_its_materials(self, site):
        upload = xlsx_upload(
            [
                BOQ_HEADER,
                ["1", "RCC retaining wall", "cum", 100, 10000, -10],
                [
                    "1.1",
                    "Supply of cement",
                    "bag",
                    640,
                    None,
                    None,
                    380,
                    360,
                ],
            ]
        )

        result = costing_boq_import.import_items(site, upload)

        assert result["created"] == 2
        assert result["errors"] == []
        cement = CostingBoqItem.objects.get(
            description="Supply of cement"
        )
        assert cement.parent.description == "RCC retaining wall"
        assert cement.rate == D("380.00")
        assert cement.our_cost_rate == D("360.00")

    def test_reimporting_the_same_file_skips_existing_rows(self, site):
        upload = xlsx_upload(
            [BOQ_HEADER, ["1", "RCC retaining wall", "cum", 100, 10000, -10]]
        )
        costing_boq_import.import_items(site, upload)

        again = xlsx_upload(
            [BOQ_HEADER, ["1", "RCC retaining wall", "cum", 100, 10000, -10]]
        )
        result = costing_boq_import.import_items(site, again)

        assert result["created"] == 0
        assert result["skipped_existing"] == 1
        assert CostingBoqItem.objects.count() == 1

    def test_a_row_with_no_description_is_skipped(self, site):
        upload = xlsx_upload([BOQ_HEADER, ["1", "", "cum", 100]])

        result = costing_boq_import.import_items(site, upload)

        assert result["created"] == 0
        assert result["skipped_invalid"] == 1
        assert len(result["errors"]) == 1

    def test_a_bad_file_with_no_description_column_is_refused(self, site):
        upload = xlsx_upload([["Foo", "Bar"], [1, 2]])

        with pytest.raises(ValidationError):
            costing_boq_import.import_items(site, upload)

    def test_the_template_downloads(self):
        content = costing_boq_import.build_template()

        workbook = openpyxl.load_workbook(io.BytesIO(content))
        sheet = workbook.active
        assert sheet["B1"].value == "Description"

    def test_import_endpoint_requires_costing_access(self, site):
        upload = xlsx_upload(
            [BOQ_HEADER, ["1", "RCC retaining wall", "cum", 100, 10000, -10]]
        )
        client = client_for(ProjectManagerUserFactory())

        response = client.post(
            f"{url('costing-boq-import')}?site={site.id}",
            {"file": upload},
            format="multipart",
        )

        assert response.status_code == FORBIDDEN

    def test_import_endpoint_works_for_admin(self, site):
        upload = xlsx_upload(
            [BOQ_HEADER, ["1", "RCC retaining wall", "cum", 100, 10000, -10]]
        )
        client = client_for(AdminUserFactory())

        response = client.post(
            f"{url('costing-boq-import')}?site={site.id}",
            {"file": upload},
            format="multipart",
        )

        assert response.status_code == OK, response.data
        assert response.data["data"]["created"] == 1

    def test_template_endpoint_downloads_an_xlsx(self, site):
        client = client_for(DirectorUserFactory())

        response = client.get(url("costing-boq-template"))

        assert response.status_code == OK
        assert response["Content-Type"].startswith(
            "application/vnd.openxmlformats"
        )
