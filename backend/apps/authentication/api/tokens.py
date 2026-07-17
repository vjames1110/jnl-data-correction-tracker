from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
)


class ApplicationTokenSerializer(
    TokenObtainPairSerializer
):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["employee_id"] = user.employee_id
        token["role"] = user.role
        token["full_name"] = user.full_name
        token["must_change_password"] = (
            user.must_change_password
        )

        return token