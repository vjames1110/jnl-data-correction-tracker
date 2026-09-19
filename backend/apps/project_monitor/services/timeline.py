"""
A project's schedule facts: its effective end date (the latest
contract extension, else the original end date) and the days left to
it. Shared by the overview countdown and the finance summary so the
two can never disagree.
"""

from django.utils import timezone


def effective_end_date(site):
    extension_dates = [
        extension.new_end_date
        for extension in site.extensions.all()
    ]
    if extension_dates:
        return max(extension_dates)
    return site.end_date


def days_remaining(site, today=None):
    end = effective_end_date(site)
    if end is None:
        return None
    return (end - (today or timezone.localdate())).days
