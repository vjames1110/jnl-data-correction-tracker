from .base import *  # noqa: F403, F401

from decouple import config


DEBUG = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

if not config("USE_REMOTE_DATABASE", default=False, cast=bool):
    DATABASES = {  # noqa: F405
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
        },
    }
