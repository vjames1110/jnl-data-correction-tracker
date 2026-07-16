import uuid

from django.db import models

from apps.core.models import (
    ActiveStatusModel,
    BaseModel,
    BusinessModel,
    TimeStampedModel,
    UUIDPrimaryKeyModel,
)


def test_core_models_are_abstract():
    abstract_models = [
        UUIDPrimaryKeyModel,
        TimeStampedModel,
        ActiveStatusModel,
        BaseModel,
        BusinessModel,
    ]

    for model_class in abstract_models:
        assert model_class._meta.abstract is True


def test_uuid_primary_key_model_uses_uuid_field():
    field = UUIDPrimaryKeyModel._meta.get_field("id")

    assert isinstance(field, models.UUIDField)
    assert field.primary_key is True
    assert field.default is uuid.uuid4


def test_active_status_model_defaults_to_active():
    field = ActiveStatusModel._meta.get_field(
        "is_active"
    )

    assert field.default is True
    assert field.db_index is True