"""Builders for the finance-tier (DPR/billing) tests."""

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.project_monitor.services import dpr


def make_item(site, **overrides):
    values = {
        "description": "Earthwork in embankment",
        "item_no": "1.1",
        "unit": "cum",
        "scope_qty": Decimal("1000"),
        "rate": Decimal("100"),
    }
    values.update(overrides)
    return dpr.create_item(site=site, **values)


def days_ago(count):
    return timezone.localdate() - timedelta(days=count)
