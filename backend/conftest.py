import os

import django
import pytest
from django.core.management import call_command


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

django.setup()


@pytest.fixture(scope="session", autouse=True)
def test_database():
    call_command("migrate", interactive=False, verbosity=0)
