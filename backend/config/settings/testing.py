from .base import *  # noqa: F403, F401


DEBUG = False

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "CONN_MAX_AGE": None,
    },
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

STATICFILES_DIRS = []

MIDDLEWARE = [
    middleware
    for middleware in MIDDLEWARE  # noqa: F405
    if middleware != "whitenoise.middleware.WhiteNoiseMiddleware"
]

# Tests never talk to a real bucket, even when a developer has R2
# credentials in their .env - uploads go to a throw-away local folder.
STORAGES = {  # noqa: F405
    **STORAGES,  # noqa: F405
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
}
