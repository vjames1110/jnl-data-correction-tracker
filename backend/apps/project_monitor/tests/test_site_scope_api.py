"""
Task-wise site access across the whole Project Monitor API: two sites,
and for each kind of person what they can read and write, task by
task, on the site they were granted and on the other one. Runs
against the real rules.
"""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    HrDepartmentUserFactory,
    MachineryDepartmentUserFactory,
    ProjectHoUserFactory,
    ProjectInchargeUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.project_monitor.api import urls as project_monitor_urls
from apps.project_monitor.models import (
    Activity,
    ActivityDateEntry,
    ActionItem,
    ChainageSegment,
    GirderSpan,
    LinearItem,
    ProgressEntry,
    ProjectExtension,
    ProjectSiteAccess,
    ScopePatch,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services import project_scope
from apps.project_monitor.tests.scope_helpers import grant

pytestmark = [pytest.mark.real_scope, pytest.mark.django_db]

OK = status.HTTP_200_OK
DENIED = status.HTTP_403_FORBIDDEN
ALL = project_scope.ALL_TASKS
GRANTABLE = project_scope.GRANTABLE_TASKS


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def _future(days):
    return str(timezone.localdate() + timedelta(days=days))


MINOR_BRIDGE = {
    "name": "Br. No. 214",
    "chainage_km": "12.345",
    "config": {"w": 3, "h": 3, "cells": 1, "barrel": 12, "returns": 4, "stairs": 2, "apron": True},
}
BUILDING = {
    "name": "Station building",
    "station_label": "Chunar station",
    "chainage_km": "10.500",
    "config": {"gf": 500, "up": 1, "uf": 500, "found": "open", "lift": True, "fire": False, "ext": True},
}
GIRDER_JOB = {
    "structure_kind": "MAJOR",
    "bridge_name": "Br. No. 310",
    "chainage_km": "15.500",
    "girder_scope": "JNL",
    "spans": [
        {
            "label": "S1",
            "is_standard": True,
            "drawing_no": "RDSO/B-1234",
            "span_length_m": "24.40",
            "girder_type": "Welded plate girder",
            "qty_mt": "45.500",
            "bearings_count": 4,
            "expansion_joints_count": 2,
        }
    ],
}
ACTION_ITEM = {
    "name": "Follow up on ROW handover",
    "responsibility": "Site Engineer",
    "remarks": "Discussed in weekly meeting.",
    "target_date": "2027-06-01",
}
PROGRESS = {
    "date": "2026-01-05",
    "meeting_date": "2026-01-05",
    "from_chainage_km": "0.000",
    "to_chainage_km": "2.000",
    "status": "COMPLETE",
}
SCOPE_PATCH = {"from_chainage_km": "2.000", "to_chainage_km": "4.500", "side": "LHS"}


def seed(admin_api, site):
    """One object of every kind on ``site``, made by an Admin."""
    q = f"?site={site.id}"
    minor = StructureTypeDefinition.objects.get(code="MINOR")

    def post(name, body):
        response = admin_api.post(url(name) + q, body, format="json")
        assert response.status_code == OK, (name, response.data)
        return response.data["data"]

    structure = post("structure-list", {**MINOR_BRIDGE, "structure_type": str(minor.id)})
    building = post("building-list", BUILDING)
    job = post("girder-job-list", GIRDER_JOB)
    action = post("action-item-list", ACTION_ITEM)
    linear = post("linear-item-list", {"name": "Earthwork", "unit": "M"})
    post("extension-list", {"new_end_date": _future(60), "reason": "x"})
    post("chainage-segment-list", {"from_chainage_km": "1.000", "to_chainage_km": "2.000", "vendor": "ABC Infra"})
    for path, body in (("scope-patch-list", SCOPE_PATCH), ("progress-entry-list", PROGRESS)):
        response = admin_api.post(url(path, linear["id"]), body, format="json")
        assert response.status_code == OK, (path, response.data)

    structure_row = Structure.objects.get(pk=structure["id"])
    span = GirderSpan.objects.get(job_id=job["id"])
    return {
        "site": site,
        "structure": structure_row.id,
        "building": building["id"],
        "job": job["id"],
        "span": span.id,
        "action": action["id"],
        "linear": linear["id"],
        "patch": ScopePatch.objects.get(linear_item_id=linear["id"]).id,
        "entry": ProgressEntry.objects.get(linear_item_id=linear["id"]).id,
        "extension": ProjectExtension.objects.get(site=site).id,
        "chainage_segment": ChainageSegment.objects.get(site=site).id,
        "activity": Activity.objects.filter(object_id=structure_row.id).first().id,
        "action_activity": Activity.objects.filter(object_id=action["id"]).first().id,
        "span_activity": Activity.objects.filter(object_id=span.id).first().id,
    }


@pytest.fixture
def admin_api():
    client = APIClient()
    client.force_authenticate(user=AdminUserFactory())
    return client


@pytest.fixture
def world(site, other_site, admin_api):
    return {"a": seed(admin_api, site), "b": seed(admin_api, other_site)}


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---- the operations under test: name -> (task it needs, callable) --------------


def read_ops(t):
    s = {"site": str(t["site"].id)}
    return {
        "overview": (None, lambda c: c.get(url("overview"), s)),
        "extensions": (None, lambda c: c.get(url("extension-list"), s)),
        "chainage segments": (None, lambda c: c.get(url("chainage-segment-list"), s)),
        "structures": ("STRUCTURES", lambda c: c.get(url("structure-list"), s)),
        "structure": ("STRUCTURES", lambda c: c.get(url("structure-detail", t["structure"]))),
        "buildings": ("BUILDINGS", lambda c: c.get(url("building-list"), s)),
        "building": ("BUILDINGS", lambda c: c.get(url("building-detail", t["building"]))),
        "girder jobs": ("GIRDERS", lambda c: c.get(url("girder-job-list"), s)),
        "girder job": ("GIRDERS", lambda c: c.get(url("girder-job-detail", t["job"]))),
        "action items": ("ACTION_ITEMS", lambda c: c.get(url("action-item-list"), s)),
        "action item": ("ACTION_ITEMS", lambda c: c.get(url("action-item-detail", t["action"]))),
        "linear items": ("LINEAR_WORKS", lambda c: c.get(url("linear-item-list"), s)),
        "linear item": ("LINEAR_WORKS", lambda c: c.get(url("linear-item-detail", t["linear"]))),
        "overdue counts": (None, lambda c: c.get(url("overdue-counts"), s)),
        "due tracker": (None, lambda c: c.get(url("due-tracker"), s)),
    }


def entry_ops(t):
    """Writes that change nothing permanently, so they can be rerun."""
    q = f"?site={t['site'].id}"
    minor = StructureTypeDefinition.objects.get(code="MINOR")
    return {
        "edit overview": ("OVERVIEW", lambda c: c.patch(url("overview") + q, {"client_or_section": "NCR"}, format="json")),
        "add extension": ("OVERVIEW", lambda c: c.post(url("extension-list") + q, {"new_end_date": _future(90), "reason": "again"}, format="json")),
        "add chainage segment": ("OVERVIEW", lambda c: c.post(url("chainage-segment-list") + q, {"from_chainage_km": "3.000", "to_chainage_km": "4.000"}, format="json")),
        "add structure": ("STRUCTURES", lambda c: c.post(url("structure-list") + q, {**MINOR_BRIDGE, "name": "New", "structure_type": str(minor.id)}, format="json")),
        "edit structure": ("STRUCTURES", lambda c: c.patch(url("structure-detail", t["structure"]), {"name": "Renamed"}, format="json")),
        "add building": ("BUILDINGS", lambda c: c.post(url("building-list") + q, {**BUILDING, "name": "New"}, format="json")),
        "add girder job": ("GIRDERS", lambda c: c.post(url("girder-job-list") + q, {**GIRDER_JOB, "bridge_name": "New"}, format="json")),
        "edit girder span": ("GIRDERS", lambda c: c.patch(url("girder-span-update", t["span"]), {"vendor": "V"}, format="json")),
        "add action item": ("ACTION_ITEMS", lambda c: c.post(url("action-item-list") + q, {**ACTION_ITEM, "name": "New"}, format="json")),
        "edit action item": ("ACTION_ITEMS", lambda c: c.patch(url("action-item-detail", t["action"]), {"remarks": "r"}, format="json")),
        "add linear item": ("LINEAR_WORKS", lambda c: c.post(url("linear-item-list") + q, {"name": "New", "unit": "M"}, format="json")),
        "add scope patch": ("LINEAR_WORKS", lambda c: c.post(url("scope-patch-list", t["linear"]), SCOPE_PATCH, format="json")),
        "add progress entry": ("LINEAR_WORKS", lambda c: c.post(url("progress-entry-list", t["linear"]), PROGRESS, format="json")),
        "edit progress entry": ("LINEAR_WORKS", lambda c: c.patch(url("progress-entry-detail", t["entry"]), {"remarks": "r"}, format="json")),
        "update structure activity": ("STRUCTURES", lambda c: c.patch(url("activity-update", t["activity"]), {"meeting_date": "2026-09-01", "comment": "ok"}, format="json")),
        "update action item activity": ("ACTION_ITEMS", lambda c: c.patch(url("activity-update", t["action_activity"]), {"meeting_date": "2026-09-01", "comment": "ok"}, format="json")),
        "update girder activity": ("GIRDERS", lambda c: c.patch(url("activity-update", t["span_activity"]), {"meeting_date": "2026-09-01", "comment": "ok"}, format="json")),
    }


def review_ops(t):
    return {
        "review structure": ("STRUCTURES", lambda c: c.post(url("structure-review", t["structure"]), {}, format="json")),
        "review building": ("BUILDINGS", lambda c: c.post(url("building-review", t["building"]), {}, format="json")),
        "review girder job": ("GIRDERS", lambda c: c.post(url("girder-job-review", t["job"]), {}, format="json")),
        "review structure activity": ("STRUCTURES", lambda c: c.post(url("activity-review", t["activity"]), {}, format="json")),
        "review action item activity": ("ACTION_ITEMS", lambda c: c.post(url("activity-review", t["action_activity"]), {}, format="json")),
    }


def delete_ops(t):
    # Children first: deleting a linear item cascades its patches and
    # entries, which would make their own deletes 404.
    return {
        "delete scope patch": ("LINEAR_WORKS", lambda c: c.delete(url("scope-patch-detail", t["patch"]))),
        "delete progress entry": ("LINEAR_WORKS", lambda c: c.delete(url("progress-entry-detail", t["entry"]))),
        "delete extension": ("OVERVIEW", lambda c: c.delete(url("extension-detail", t["extension"]))),
        "delete chainage segment": ("OVERVIEW", lambda c: c.delete(url("chainage-segment-detail", t["chainage_segment"]))),
        "delete structure": ("STRUCTURES", lambda c: c.delete(url("structure-detail", t["structure"]))),
        "delete building": ("BUILDINGS", lambda c: c.delete(url("building-detail", t["building"]))),
        "delete girder job": ("GIRDERS", lambda c: c.delete(url("girder-job-detail", t["job"]))),
        "delete action item": ("ACTION_ITEMS", lambda c: c.delete(url("action-item-detail", t["action"]))),
        "delete linear item": ("LINEAR_WORKS", lambda c: c.delete(url("linear-item-detail", t["linear"]))),
    }


def assert_matrix(ops, client, granted):
    """
    Every op succeeds exactly when the person holds its task (an op
    with no task needs just any grant on the site).
    """
    wrong = {}
    for name, (task, op) in ops.items():
        expected = OK if (bool(granted) if task is None else task in granted) else DENIED
        got = op(client).status_code
        if got != expected:
            wrong[name] = (got, expected)
    assert not wrong, f"(got, expected) mismatches: {wrong}"


def assert_all(ops, client, expected):
    got = {name: op(client).status_code for name, (_task, op) in ops.items()}
    wrong = {n: s for n, s in got.items() if s != expected}
    assert not wrong, f"expected {expected} everywhere, got {wrong}"


# ---- one person, every task ------------------------------------------------------


def test_a_person_with_every_task_works_on_their_site_only(world, site, other_site):
    incharge = grant(ProjectInchargeUserFactory(), site)
    client = client_for(incharge)

    for ops in (read_ops, entry_ops, review_ops):
        assert_all(ops(world["a"]), client, OK)
        assert_all(ops(world["b"]), client, DENIED)

    # Deletes: refused on the other site (nothing removed) ...
    assert_all(delete_ops(world["b"]), client, DENIED)
    assert Structure.objects.filter(pk=world["b"]["structure"]).exists()
    assert LinearItem.objects.filter(pk=world["b"]["linear"]).exists()
    # ... allowed on their own.
    assert_all(delete_ops(world["a"]), client, OK)
    assert not Structure.objects.filter(pk=world["a"]["structure"]).exists()
    assert not ActionItem.objects.filter(pk=world["a"]["action"]).exists()


# ---- partial access: one task, or a mix ---------------------------------------------


@pytest.mark.parametrize(
    "tasks",
    [
        {"STRUCTURES"},
        {"BUILDINGS", "GIRDERS"},
        {"ACTION_ITEMS", "LINEAR_WORKS", "OVERVIEW"},
        {"DPR_BILLS"},  # a finance-only person still sees the site summary
        {"REPORTS"},
    ],
)
def test_a_person_can_use_exactly_the_tasks_they_hold(world, site, tasks):
    person = grant(ProjectManagerUserFactory(), site, *tasks)
    client = client_for(person)

    for ops in (read_ops, entry_ops, review_ops):
        assert_matrix(ops(world["a"]), client, tasks)
    # The other site stays closed whatever they hold here.
    for ops in (read_ops, entry_ops, review_ops):
        assert_all(ops(world["b"]), client, DENIED)


def test_activity_updates_follow_the_task_of_the_activity_parent(world, site):
    structures_only = client_for(grant(ProjectManagerUserFactory(), site, "STRUCTURES"))
    t = world["a"]
    body = {"meeting_date": "2026-09-01", "comment": "ok"}

    assert structures_only.patch(url("activity-update", t["activity"]), body, format="json").status_code == OK
    # Same site, but an action item's or a girder's activity is another task.
    assert structures_only.patch(url("activity-update", t["action_activity"]), body, format="json").status_code == DENIED
    assert structures_only.patch(url("activity-update", t["span_activity"]), body, format="json").status_code == DENIED


def test_a_person_with_no_task_gets_nothing(world):
    for user in (ProjectManagerUserFactory(), ProjectInchargeUserFactory(), UserFactory()):
        client = client_for(user)
        for key in ("a", "b"):
            for ops in (read_ops, entry_ops, review_ops, delete_ops):
                assert_all(ops(world[key]), client, DENIED)
    assert Structure.objects.count() == 2


# ---- several people on one site --------------------------------------------------------


def test_two_incharges_on_one_site_each_get_only_their_own_tasks(world, site):
    everything = client_for(grant(ProjectInchargeUserFactory(), site))
    dpr_only = client_for(grant(ProjectInchargeUserFactory(), site, "DPR_BILLS"))

    assert everything.get(url("structure-list"), {"site": str(site.id)}).status_code == OK
    assert dpr_only.get(url("structure-list"), {"site": str(site.id)}).status_code == DENIED
    assert dpr_only.get(url("overview"), {"site": str(site.id)}).status_code == OK

    assert everything.get(url("financial-summary"), {"site": str(site.id)}).status_code == OK
    assert dpr_only.get(url("financial-summary"), {"site": str(site.id)}).status_code == OK
    # HR and Machinery belong to their departments: never an Incharge's,
    # not even one who holds every grantable task.
    for name in ("hr-summary", "machinery-summary"):
        assert everything.get(url(name), {"site": str(site.id)}).status_code == DENIED
        assert dpr_only.get(url(name), {"site": str(site.id)}).status_code == DENIED


# ---- Director / Admin ---------------------------------------------------------------------


def test_director_reads_and_reviews_everywhere_but_never_enters(world):
    client = client_for(DirectorUserFactory())
    for key in ("a", "b"):
        assert_all(read_ops(world[key]), client, OK)
        assert_all(review_ops(world[key]), client, OK)
        assert_all(entry_ops(world[key]), client, DENIED)
        assert_all(delete_ops(world[key]), client, DENIED)
    assert Structure.objects.count() == 2


def test_admin_can_do_everything_on_every_site(world):
    client = client_for(AdminUserFactory())
    for key in ("a", "b"):
        for ops in (read_ops, entry_ops, review_ops):
            assert_all(ops(world[key]), client, OK)
    for key in ("a", "b"):
        assert_all(delete_ops(world[key]), client, OK)
        assert not Structure.objects.filter(pk=world[key]["structure"]).exists()


HO_VIEW = {"OVERVIEW", "STRUCTURES", "BUILDINGS", "GIRDERS", "ACTION_ITEMS", "LINEAR_WORKS", "DPR_BILLS", "REPORTS"}


def test_project_ho_sees_every_site_but_enters_only_the_overview(world):
    client = client_for(ProjectHoUserFactory())
    for key in ("a", "b"):
        assert_matrix(read_ops(world[key]), client, HO_VIEW)
        assert_matrix(review_ops(world[key]), client, HO_VIEW)
        # Entry is the Overview alone - nothing else, on any site.
        assert_matrix(entry_ops(world[key]), client, {"OVERVIEW"})
    # Nothing outside the Overview was added by that.
    assert Structure.objects.count() == 2
    assert ActionItem.objects.count() == 2


def test_project_ho_can_remove_overview_items_but_nothing_else(world):
    client = client_for(ProjectHoUserFactory())
    for key in ("a", "b"):
        assert_matrix(delete_ops(world[key]), client, {"OVERVIEW"})
    assert Structure.objects.count() == 2
    assert LinearItem.objects.count() == 2


@pytest.mark.parametrize(
    "factory",
    [HrDepartmentUserFactory, MachineryDepartmentUserFactory],
)
def test_the_departments_get_no_progress_data_at_all(world, factory):
    client = client_for(factory())
    for key in ("a", "b"):
        for ops in (read_ops, entry_ops, review_ops, delete_ops):
            assert_all(ops(world[key]), client, DENIED)
    assert client.get(url("dashboard")).status_code == DENIED
    assert client.get(url("due-tracker")).status_code == DENIED
    assert Structure.objects.count() == 2
    # Their one page still needs the list of sites to pick from.
    assert client.get(url("project-sites")).status_code == OK


def test_the_project_ho_dashboard_lists_every_project(world):
    response = client_for(ProjectHoUserFactory()).get(
        url("dashboard"), {"include_empty": "1"}
    )
    assert response.status_code == OK
    assert _project_codes(response) == ["CHK", "OTH"]


def test_a_forged_site_id_for_another_project_is_refused(world, other_site):
    client = client_for(grant(ProjectInchargeUserFactory(), world["a"]["site"]))
    forged = client.get(url("structure-list"), {"site": str(other_site.id)})
    assert forged.status_code == DENIED


# ---- multi-site endpoints -----------------------------------------------------------------------


def _project_codes(response):
    return sorted(p["site"]["site_code"] for p in response.data["data"]["projects"])


def test_dashboard_lists_the_projects_where_the_person_holds_a_task(world, site, other_site):
    query = {"include_empty": "1"}
    finance_only_a = grant(ProjectManagerUserFactory(), site, "DPR_BILLS")
    on_both = ProjectInchargeUserFactory()
    grant(on_both, site, "STRUCTURES")
    grant(on_both, other_site, "REPORTS")

    assert _project_codes(client_for(finance_only_a).get(url("dashboard"), query)) == ["CHK"]
    assert _project_codes(client_for(on_both).get(url("dashboard"), query)) == ["CHK", "OTH"]
    assert _project_codes(client_for(DirectorUserFactory()).get(url("dashboard"), query)) == ["CHK", "OTH"]
    assert _project_codes(client_for(ProjectManagerUserFactory()).get(url("dashboard"), query)) == []


def test_dashboard_totals_only_count_the_projects_the_person_may_see(world, site, other_site):
    """
    "My Projects" must be a true subset: the headline numbers (projects,
    activities, overdue) and the per-kind-of-work rollups for a person
    on site A must equal site A alone, while Admin and Director get
    the sum over every site.
    """
    query = {"include_empty": "1"}

    def totals(user):
        return client_for(user).get(url("dashboard"), query).data["data"]

    only_a = grant(ProjectManagerUserFactory(), site, "STRUCTURES")
    incharge_b = grant(ProjectInchargeUserFactory(), other_site, "STRUCTURES")

    a = totals(only_a)
    b = totals(incharge_b)
    everyone = totals(AdminUserFactory())
    director = totals(DirectorUserFactory())

    assert a["totals"]["projects"] == 1
    assert b["totals"]["projects"] == 1
    assert everyone["totals"]["projects"] == 2
    assert director["totals"]["projects"] == 2

    # The two scoped views add up to the unscoped one - nothing leaks
    # in either direction.
    for field in ("total", "done", "in_progress", "hold", "not_started"):
        assert (
            a["totals"]["activities"][field] + b["totals"]["activities"][field]
            == everyone["totals"]["activities"][field]
        )
        assert director["totals"]["activities"][field] == everyone["totals"]["activities"][field]
    assert a["totals"]["overdue"] + b["totals"]["overdue"] == everyone["totals"]["overdue"]
    assert a["totals"]["activities"]["total"] > 0

    # The per-project rollup a scoped person gets is for their site only.
    assert [p["site"]["site_code"] for p in a["projects"]] == ["CHK"]
    assert [p["site"]["site_code"] for p in b["projects"]] == ["OTH"]


def test_dashboard_money_needs_the_dpr_task(world, site, admin_api):
    # Give site A a bill so it has money figures.
    admin_api.post(
        url("ra-bill-list"),
        {"site": str(site.id), "bill_no": "L1", "bill_date": str(timezone.localdate()), "kind": "AMOUNT", "amount": "1000"},
        format="json",
    )
    with_dpr = client_for(grant(ProjectManagerUserFactory(), site, "DPR_BILLS"))
    without = client_for(grant(ProjectManagerUserFactory(), site, "STRUCTURES"))

    def money(client):
        return client.get(url("dashboard")).data["data"]["projects"][0]["money"]

    assert money(with_dpr)["work_done_total"] == 1000
    assert money(without) is None


def test_due_tracker_shows_only_the_modules_of_the_tasks_held(world, site, other_site):
    query = {"mode": "date", "date": "2027-06-01"}  # the seeded action items

    def rows(user):
        response = client_for(user).get(url("due-tracker"), query)
        assert response.status_code == OK
        return {(r["site_code"], r["module"]) for r in response.data["data"]["rows"]}

    action_items = grant(ProjectManagerUserFactory(), site, "ACTION_ITEMS")
    structures = grant(ProjectManagerUserFactory(), site, "STRUCTURES")
    across = ProjectInchargeUserFactory()
    grant(across, site, "ACTION_ITEMS")
    grant(across, other_site, "ACTION_ITEMS")

    assert rows(AdminUserFactory()) == {("CHK", "action_items"), ("OTH", "action_items")}
    assert rows(action_items) == {("CHK", "action_items")}
    assert rows(structures) == set()
    assert rows(across) == {("CHK", "action_items"), ("OTH", "action_items")}
    assert rows(ProjectManagerUserFactory()) == set()


def test_overdue_counts_only_cover_the_modules_held(world, site):
    yesterday = timezone.localdate() - timedelta(days=1)
    t = world["a"]
    for activity_id in (t["activity"], t["action_activity"]):
        ActivityDateEntry.objects.create(
            activity_id=activity_id, target_date=yesterday, meeting_date=yesterday
        )

    def counts(user):
        return client_for(user).get(url("overdue-counts"), {"site": str(site.id)}).data["data"]

    admin = counts(AdminUserFactory())
    assert admin["structures"] >= 1 and admin["action_items"] >= 1

    partial = counts(grant(ProjectManagerUserFactory(), site, "STRUCTURES"))
    assert partial["structures"] >= 1
    assert partial["action_items"] == 0


def test_sites_endpoint_lists_each_sites_tasks(world, site, other_site):
    person = ProjectInchargeUserFactory()
    grant(person, site, "STRUCTURES", "DPR_BILLS")
    grant(person, other_site, "REPORTS")

    def sites(user):
        response = client_for(user).get(url("project-sites"))
        assert response.status_code == OK
        return {s["code"]: s for s in response.data["data"]}

    mine = sites(person)
    assert mine["CHK"]["tasks"] == ["STRUCTURES", "DPR_BILLS"]
    assert mine["CHK"]["enter_tasks"] == ["STRUCTURES", "DPR_BILLS"]
    assert mine["OTH"]["tasks"] == ["REPORTS"]
    assert mine["CHK"]["read_only"] is False

    director = sites(DirectorUserFactory())
    assert director["CHK"]["tasks"] == list(ALL)
    assert director["CHK"]["enter_tasks"] == []
    assert director["CHK"]["read_only"] is True
    assert sites(AdminUserFactory())["OTH"]["read_only"] is False

    # The Project Management HO sees most tasks on every site but can
    # enter only the Overview; the departments see only their own.
    ho = sites(ProjectHoUserFactory())
    assert set(ho) == {"CHK", "OTH"}
    assert ho["CHK"]["enter_tasks"] == ["OVERVIEW"]
    assert "HR" not in ho["CHK"]["tasks"]
    assert ho["CHK"]["read_only"] is False
    hr = sites(HrDepartmentUserFactory())
    assert hr["OTH"]["tasks"] == ["HR"] == hr["OTH"]["enter_tasks"]
    assert sites(MachineryDepartmentUserFactory())["CHK"]["tasks"] == ["MACHINERY"]
    assert sites(ProjectManagerUserFactory()) == {}
    assert client_for(UserFactory()).get(url("project-sites")).status_code == DENIED


# ---- the grants API (Admin) ----------------------------------------------------------------------


def test_site_access_lists_people_and_who_could_be_added(site, admin_api):
    first = grant(ProjectInchargeUserFactory(), site)
    second = grant(ProjectManagerUserFactory(), site, "STRUCTURES", "DPR_BILLS")
    free = ProjectInchargeUserFactory()

    data = admin_api.get(url("site-access-list"), {"site": str(site.id)}).data["data"]

    # The grid offers only the grantable tasks (no HR / Machinery).
    assert [m["key"] for m in data["tasks"]] == list(GRANTABLE)
    people = {p["user_employee_id"]: p for p in data["people"]}
    assert people[first.employee_id]["tasks"] == list(GRANTABLE)
    assert people[second.employee_id]["tasks"] == ["STRUCTURES", "DPR_BILLS"]
    assert people[first.employee_id]["role_label"] == "Project Incharge"
    eligible = {e["employee_id"] for e in data["eligible"]}
    assert free.employee_id in eligible
    assert first.employee_id not in eligible


def test_set_replaces_a_persons_tasks_atomically(site, admin_api):
    incharge = ProjectInchargeUserFactory()
    body = {"site": str(site.id), "user": str(incharge.id)}

    added = admin_api.put(url("site-access-set"), {**body, "tasks": ["STRUCTURES", "DPR_BILLS"]}, format="json")
    assert added.status_code == OK
    assert added.data["data"]["tasks"] == ["STRUCTURES", "DPR_BILLS"]

    changed = admin_api.put(url("site-access-set"), {**body, "tasks": ["DPR_BILLS", "REPORTS"]}, format="json")
    assert changed.data["data"]["tasks"] == ["DPR_BILLS", "REPORTS"]
    assert set(ProjectSiteAccess.objects.filter(user=incharge).values_list("role", flat=True)) == {"DPR_BILLS", "REPORTS"}

    removed = admin_api.put(url("site-access-set"), {**body, "tasks": []}, format="json")
    assert removed.status_code == OK
    assert not ProjectSiteAccess.objects.filter(user=incharge).exists()


def test_hr_and_machinery_cannot_be_granted_per_site(site, admin_api):
    incharge = ProjectInchargeUserFactory()
    for task in ("HR", "MACHINERY"):
        response = admin_api.put(
            url("site-access-set"),
            {"site": str(site.id), "user": str(incharge.id), "tasks": [task]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert ProjectSiteAccess.objects.count() == 0


def test_saving_a_persons_tasks_clears_an_old_hr_grant(site, admin_api):
    incharge = ProjectInchargeUserFactory()
    ProjectSiteAccess.objects.bulk_create(
        [ProjectSiteAccess(site=site, user=incharge, role="HR")]
    )

    admin_api.put(
        url("site-access-set"),
        {"site": str(site.id), "user": str(incharge.id), "tasks": ["STRUCTURES"]},
        format="json",
    )

    assert set(ProjectSiteAccess.objects.filter(user=incharge).values_list("role", flat=True)) == {"STRUCTURES"}


def test_set_only_touches_the_named_site_and_person(site, other_site, admin_api):
    incharge = grant(ProjectInchargeUserFactory(), other_site, "REPORTS")
    other_person = grant(ProjectInchargeUserFactory(), site, "STRUCTURES")

    admin_api.put(
        url("site-access-set"),
        {"site": str(site.id), "user": str(incharge.id), "tasks": ["BUILDINGS"]},
        format="json",
    )

    assert set(ProjectSiteAccess.objects.filter(user=incharge, site=other_site).values_list("role", flat=True)) == {"REPORTS"}
    assert set(ProjectSiteAccess.objects.filter(user=other_person).values_list("role", flat=True)) == {"STRUCTURES"}


def test_a_new_grant_takes_effect_immediately(world, site, admin_api):
    incharge = ProjectInchargeUserFactory()
    client = client_for(incharge)
    assert client.get(url("structure-list"), {"site": str(site.id)}).status_code == DENIED

    admin_api.put(
        url("site-access-set"),
        {"site": str(site.id), "user": str(incharge.id), "tasks": ["STRUCTURES"]},
        format="json",
    )
    assert client.get(url("structure-list"), {"site": str(site.id)}).status_code == OK
    assert client.get(url("building-list"), {"site": str(site.id)}).status_code == DENIED


def test_only_incharges_and_managers_can_be_granted(site, admin_api):
    for user in (DirectorUserFactory(), UserFactory(), AdminUserFactory()):
        response = admin_api.put(
            url("site-access-set"),
            {"site": str(site.id), "user": str(user.id), "tasks": ["STRUCTURES"]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert ProjectSiteAccess.objects.count() == 0


def test_set_rejects_unknown_tasks_and_unknown_sites(site, admin_api):
    incharge = ProjectInchargeUserFactory()
    bad_task = admin_api.put(
        url("site-access-set"),
        {"site": str(site.id), "user": str(incharge.id), "tasks": ["EVERYTHING"]},
        format="json",
    )
    bad_site = admin_api.put(
        url("site-access-set"),
        {"site": "not-a-uuid", "user": str(incharge.id), "tasks": ["STRUCTURES"]},
        format="json",
    )
    assert bad_task.status_code == status.HTTP_400_BAD_REQUEST
    assert bad_site.status_code == status.HTTP_400_BAD_REQUEST


def test_site_access_is_admin_only(site):
    person = grant(ProjectInchargeUserFactory(), site)
    for user in (person, DirectorUserFactory(), ProjectManagerUserFactory()):
        client = client_for(user)
        assert client.get(url("site-access-list"), {"site": str(site.id)}).status_code == DENIED
        assert client.put(
            url("site-access-set"),
            {"site": str(site.id), "user": str(user.id), "tasks": ["STRUCTURES"]},
            format="json",
        ).status_code == DENIED
        assert client.get(url("site-scope")).status_code == DENIED


def test_site_scope_summarises_grants_per_person(site, other_site, admin_api):
    busy = ProjectInchargeUserFactory()
    grant(busy, site)
    grant(busy, other_site, "REPORTS")
    idle = ProjectManagerUserFactory()

    rows = {r["employee_id"]: r for r in admin_api.get(url("site-scope")).data["data"]}

    assert {s["code"]: s["task_count"] for s in rows[busy.employee_id]["sites"]} == {
        "CHK": len(GRANTABLE),
        "OTH": 1,
    }
    assert [s["all_tasks"] for s in rows[busy.employee_id]["sites"]] == [True, False]
    assert rows[idle.employee_id]["sites"] == []
    assert rows[busy.employee_id]["role"] == "PROJECT_INCHARGE"


# ---- guard: every route must be classified -------------------------------------------------------------

# Routes whose task scoping the matrix above exercises.
TASK_SCOPED_ROUTES = {
    "overview", "extension-list", "extension-detail",
    "chainage-segment-list", "chainage-segment-detail", "structure-list", "structure-detail",
    "structure-review", "building-list", "building-detail", "building-review",
    "girder-job-list", "girder-job-detail", "girder-job-review", "girder-span-update",
    "action-item-list", "action-item-detail", "linear-item-list", "linear-item-detail",
    "scope-patch-list", "scope-patch-detail", "progress-entry-list", "progress-entry-detail",
    "activity-update", "activity-review", "dashboard", "due-tracker", "overdue-counts",
    "project-sites",
}
# Finance tasks: per-task rules in services/site_access (test_project_scope,
# test_dpr_api, test_hr_api, test_machinery_api).
FINANCE_ROUTES_PREFIXES = ("dpr-", "ra-bill", "financial-", "hr-", "machinery-")
# Global masters and Admin-only screens: no site task involved.
SITE_LESS_ROUTES = {
    "structure-type-list", "structure-type-detail", "rdso-span-library-list",
    "rdso-span-library-detail", "site-access-list", "site-access-detail",
    "site-access-set", "site-scope",
}
# Costing: Director/Admin only, no per-site task grant at all (see
# HasProjectMonitorCostingAccess) - covered by test_costing_api.py.
COSTING_ROUTES = {
    "costing-access", "costing-glance", "costing-table",
    "costing-rate-list", "costing-rate-detail",
    "costing-production-list", "costing-production-detail",
    "costing-link-list", "costing-link-detail",
}


def test_every_route_is_classified_for_task_scoping():
    """
    Adding a Project Monitor endpoint without deciding which task it
    belongs to fails here - give it a task check and a case in the
    matrix, then list it in one of the sets above.
    """
    names = {
        pattern.name
        for pattern in project_monitor_urls.urlpatterns
        if getattr(pattern, "name", None)
    }
    classified = {
        name
        for name in names
        if name in TASK_SCOPED_ROUTES
        or name in SITE_LESS_ROUTES
        or name in COSTING_ROUTES
        or name.startswith(FINANCE_ROUTES_PREFIXES)
    }
    assert names - classified == set(), (
        "Unclassified Project Monitor routes: "
        f"{sorted(names - classified)}"
    )
