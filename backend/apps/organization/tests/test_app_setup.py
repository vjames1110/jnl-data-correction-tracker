from django.apps import apps
from django.conf import settings


def test_organization_app_is_installed():
    app_config = apps.get_app_config(
        "organization"
    )

    assert app_config.name == "apps.organization"
    assert (
        app_config.verbose_name
        == "Organization Masters"
    )
    assert "apps.organization" in settings.INSTALLED_APPS


def test_organization_api_url_module_is_registered():
    from apps.organization.api import urls

    assert urls.app_name == "organization-api"
    route_names = {
        getattr(pattern, "name", None)
        for pattern in urls.urlpatterns
        if getattr(pattern, "name", None)
    }

    assert "hierarchy" in route_names
    assert urls.router.registry
