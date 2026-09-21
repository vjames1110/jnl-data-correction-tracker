"""
Hook the older assignment screens into Project Monitor access: when an
Admin sets an employee's site (User Management) or a site's Project
Manager (Organization Setup), the person gets their starting tasks on
that site (see ``services.grants``).

Grants are only added when the assignment itself CHANGES - comparing
the row's previous values before it is saved - so re-saving a site or
an employee for another reason never restores tasks an Admin removed.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.employees.models import EmployeeProfile
from apps.organization.models import Site
from apps.project_monitor.services import grants


@receiver(pre_save, sender=EmployeeProfile)
def remember_profile_assignment(sender, instance, **kwargs):
    previous = (
        EmployeeProfile.objects.filter(pk=instance.pk)
        .values_list("user_id", "site_id", "role", "is_active")
        .first()
    )
    instance._pm_previous_assignment = previous


@receiver(post_save, sender=EmployeeProfile)
def grant_on_profile_assignment(
    sender, instance, created, **kwargs
):
    if not (
        instance.user_id
        and instance.site_id
        and instance.is_active
    ):
        return
    now = (
        instance.user_id,
        instance.site_id,
        instance.role,
        instance.is_active,
    )
    if getattr(instance, "_pm_previous_assignment", None) == now:
        return
    grants.ensure_default_grants(instance.user, instance.site)


@receiver(pre_save, sender=Site)
def remember_site_manager(sender, instance, **kwargs):
    previous = (
        Site.objects.filter(pk=instance.pk)
        .values_list("site_hod_id", flat=True)
        .first()
    )
    instance._pm_previous_site_hod_id = previous


@receiver(post_save, sender=Site)
def grant_on_site_manager(sender, instance, created, **kwargs):
    if not instance.site_hod_id:
        return
    if (
        getattr(instance, "_pm_previous_site_hod_id", None)
        == instance.site_hod_id
    ):
        return
    profile = instance.site_hod
    if profile.user_id and profile.is_active:
        grants.ensure_default_grants(profile.user, instance)
