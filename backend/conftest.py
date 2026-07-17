import os

import django


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

django.setup()
