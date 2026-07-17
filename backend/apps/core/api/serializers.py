from rest_framework import serializers


class HealthDataSerializer(serializers.Serializer):
    application = serializers.CharField(
        read_only=True,
    )
    company = serializers.CharField(
        read_only=True,
    )
    api_version = serializers.CharField(
        read_only=True,
    )
    status = serializers.CharField(
        read_only=True,
    )
    database = serializers.CharField(
        read_only=True,
    )
    timestamp = serializers.DateTimeField(
        read_only=True,
    )


class HealthResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = HealthDataSerializer(
        read_only=True,
    )


class SystemInformationDataSerializer(serializers.Serializer):
    application = serializers.CharField(
        read_only=True,
    )
    api_version = serializers.CharField(
        read_only=True,
    )
    environment = serializers.CharField(
        read_only=True,
    )
    debug = serializers.BooleanField(
        read_only=True,
    )
    python_version = serializers.CharField(
        read_only=True,
    )
    django_version = serializers.CharField(
        read_only=True,
    )
    operating_system = serializers.CharField(
        read_only=True,
    )
    database_engine = serializers.CharField(
        read_only=True,
    )
    timestamp = serializers.DateTimeField(
        read_only=True,
    )


class SystemInformationResponseSerializer(
    serializers.Serializer
):
    success = serializers.BooleanField(
        read_only=True,
    )
    message = serializers.CharField(
        read_only=True,
    )
    data = SystemInformationDataSerializer(
        read_only=True,
    )
