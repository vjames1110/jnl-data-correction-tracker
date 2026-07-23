from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.models import CorrectionRequest
from apps.corrections.services.drafts import create_draft


class CorrectionDraftAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            employee_id="REQAPI001",
            password="StrongPass123!",
            first_name="Request",
            last_name="User",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )
        self.other_user = User.objects.create_user(
            employee_id="REQAPI002",
            password="StrongPass123!",
            first_name="Other",
            last_name="User",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )

    def test_user_can_create_update_and_delete_own_draft(
        self,
    ):
        self.client.force_authenticate(self.user)

        create_response = self.client.post(
            "/api/v1/corrections/drafts/",
            {
                "voucher_number": "JV-API-001",
                "description": "Initial draft",
            },
            format="json",
        )

        self.assertEqual(
            create_response.status_code,
            status.HTTP_201_CREATED,
        )
        draft_id = create_response.data["data"]["id"]
        self.assertTrue(
            create_response.data["data"][
                "reference"
            ].startswith("DCT-")
        )

        patch_response = self.client.patch(
            f"/api/v1/corrections/drafts/{draft_id}/",
            {
                "description": "Updated draft",
            },
            format="json",
        )

        self.assertEqual(
            patch_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            patch_response.data["data"][
                "description"
            ],
            "Updated draft",
        )

        delete_response = self.client.delete(
            f"/api/v1/corrections/drafts/{draft_id}/",
        )

        self.assertEqual(
            delete_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(
            CorrectionRequest.objects.get(
                id=draft_id
            ).is_deleted
        )

    def test_user_cannot_view_other_users_draft(self):
        create_draft(
            requester=self.other_user,
            data={"description": "Private draft"},
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            "/api/v1/corrections/drafts/",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["data"],
            [],
        )
