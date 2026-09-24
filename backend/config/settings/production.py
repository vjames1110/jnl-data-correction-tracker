from .base import *  # noqa: F403, F401


DEBUG = False

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True

X_FRAME_OPTIONS = "DENY"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# Production uploads must not sit on the web server's own disk - it is
# wiped on every deploy/restart and never served to browsers, so
# attachments would silently disappear. Say so at startup.
if STORAGES["default"]["BACKEND"].endswith("FileSystemStorage"):  # noqa: F405
    import warnings

    warnings.warn(
        "Cloudflare R2 is not configured: uploaded attachments are "
        "being written to the server's local disk and will be lost "
        "on the next deploy. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
        "R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.",
        RuntimeWarning,
        stacklevel=2,
    )
