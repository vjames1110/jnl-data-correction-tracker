import uuid

from django.conf import settings
from django.db import models


class UUIDPrimaryKeyModel(models.Model):
    """
    Abstract model that provides a UUID primary key.

    UUIDs are safer for public API identifiers because they are not
    sequential and are difficult to guess.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """
    Abstract model containing creation and update timestamps.
    """

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        abstract = True


class UserTrackingModel(models.Model):
    """
    Abstract model recording which authenticated users created and
    last modified a record.

    This model will become active after the custom user model is added
    during the authentication phase.
    """

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_created_records",
        null=True,
        blank=True,
        editable=False,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_updated_records",
        null=True,
        blank=True,
        editable=False,
    )

    class Meta:
        abstract = True


class ActiveStatusModel(models.Model):
    """
    Abstract model providing active and inactive record management.
    """

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """
    Abstract model supporting logical deletion.

    Historical business records should normally be deactivated or
    soft-deleted rather than permanently removed.
    """

    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="%(app_label)s_%(class)s_deleted_records",
        null=True,
        blank=True,
        editable=False,
    )

    class Meta:
        abstract = True


class BaseModel(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Default base model for ordinary application records.
    """

    class Meta:
        abstract = True


class BusinessModel(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    ActiveStatusModel,
):
    """
    Base model for configurable business master records.

    Examples:
    - Site
    - Department
    - Voucher type
    - Work type
    """

    class Meta:
        abstract = True