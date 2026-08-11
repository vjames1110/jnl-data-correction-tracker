import json
from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.services.drafts import create_draft
from apps.corrections.services.submission import (
    submit_request,
)
from apps.employees.models import EmployeeProfile
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    VoucherType,
    WorkType,
)
from apps.notifications.models import (
    Notification,
    NotificationEmailDelivery,
    NotificationEmailStatus,
    NotificationEventType,
    NotificationPreference,
)
from apps.notifications.services.delivery import (
    notify_users,
)
from apps.organization.models import (
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    Site,
)


class NotificationTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()
        self.requester = User.objects.create_user(
            employee_id="NOTREQ001",
            password="StrongPass123!",
            first_name="Request",
            last_name="User",
            email="request.user@example.com",
            role=UserRole.USER,
            account_status=AccountStatus.ACTIVE,
        )
        self.director = User.objects.create_user(
            employee_id="NOTDIR001",
            password="StrongPass123!",
            first_name="Director",
            last_name="User",
            email="director.user@example.com",
            role=UserRole.DIRECTOR,
            account_status=AccountStatus.ACTIVE,
        )
        self.admin = User.objects.create_user(
            employee_id="NOTADM001",
            password="StrongPass123!",
            first_name="Admin",
            last_name="User",
            email="admin.user@example.com",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            is_staff=True,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="NOT",
            site_name="Notification Site",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        EmployeeProfile.objects.create(
            user=self.requester,
            employee_id=self.requester.employee_id,
            first_name=self.requester.first_name,
            last_name=self.requester.last_name,
            role=self.requester.role,
            site=self.site,
            department=self.department,
        )
        self.module = ErpModule.objects.create(
            module_name="Finance",
        )
        self.work_type = WorkType.objects.create(
            work_type_name="Notification Correction",
        )
        self.reason = ReasonCategory.objects.create(
            reason_name="Notification Data Entry",
        )
        self.priority = Priority.objects.create(
            priority_name="Notification High",
            sla_duration_hours=8,
            escalation_duration_hours=4,
        )
        self.voucher = VoucherType.objects.create(
            voucher_name="Notification Journal",
            erp_module=self.module,
            department=self.department,
            requires_amount=True,
        )
        DirectorMapping.objects.create(
            director=self.director,
            site=self.site,
            authority_type=ApprovalAuthorityType.PRIMARY,
        )

    def test_in_app_notification_is_created(self):
        notify_users(
            recipients=[self.requester],
            event_type=(
                NotificationEventType.REQUEST_SUBMITTED
            ),
            actor=self.admin,
            message="Submitted for testing.",
        )

        notification = Notification.objects.get(
            recipient=self.requester
        )

        self.assertEqual(
            notification.event_type,
            NotificationEventType.REQUEST_SUBMITTED,
        )
        self.assertFalse(notification.is_read)
        self.assertEqual(
            notification.message,
            "Submitted for testing.",
        )

    def test_email_delivery_is_skipped_when_disabled(self):
        notify_users(
            recipients=[self.requester],
            event_type=(
                NotificationEventType.REQUEST_SUBMITTED
            ),
        )

        delivery = NotificationEmailDelivery.objects.get()
        self.assertEqual(
            delivery.status,
            NotificationEmailStatus.SKIPPED,
        )
        self.assertIn("disabled", delivery.error_message)

    @override_settings(
        NOTIFICATION_EMAILS_ENABLED=True,
        BREVO_API_KEY="test-brevo-key",
        BREVO_API_URL="https://api.brevo.test/v3/smtp/email",
        BREVO_SENDER_EMAIL="correctionjnl@gmail.com",
        BREVO_SENDER_NAME="JNL Correction Tracker",
        APP_FRONTEND_BASE_URL="https://tracker.example.com",
    )
    @patch("apps.notifications.services.email.urlopen")
    def test_email_delivery_posts_to_brevo(self, mock_urlopen):
        NotificationPreference.objects.create(
            user=self.requester,
            email_enabled=True,
        )
        response = Mock()
        response.read.return_value = (
            b'{"messageId":"<brevo-message-id>"}'
        )
        response_context = Mock()
        response_context.__enter__ = Mock(
            return_value=response
        )
        response_context.__exit__ = Mock(return_value=None)
        mock_urlopen.return_value = response_context

        notify_users(
            recipients=[self.requester],
            event_type=(
                NotificationEventType.REQUEST_SUBMITTED
            ),
            message="Request submitted by test.",
            deep_link="/user/requests/123",
        )

        self.assertTrue(mock_urlopen.called)
        request = mock_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(
            payload["sender"]["email"],
            "correctionjnl@gmail.com",
        )
        self.assertEqual(
            payload["to"][0]["email"],
            self.requester.email,
        )
        self.assertIn(
            "https://tracker.example.com/user/requests/123",
            payload["textContent"],
        )

        delivery = NotificationEmailDelivery.objects.get()
        self.assertEqual(
            delivery.status,
            NotificationEmailStatus.SENT,
        )
        self.assertEqual(
            delivery.provider_message_id,
            "<brevo-message-id>",
        )

    @override_settings(
        NOTIFICATION_EMAILS_ENABLED=True,
        BREVO_API_KEY="test-brevo-key",
    )
    @patch("apps.notifications.services.email.urlopen")
    def test_email_preference_can_skip_delivery(
        self,
        mock_urlopen,
    ):
        NotificationPreference.objects.create(
            user=self.requester,
            email_enabled=False,
        )

        notify_users(
            recipients=[self.requester],
            event_type=(
                NotificationEventType.REQUEST_SUBMITTED
            ),
        )

        mock_urlopen.assert_not_called()
        delivery = NotificationEmailDelivery.objects.get()
        self.assertEqual(
            delivery.status,
            NotificationEmailStatus.SKIPPED,
        )
        self.assertIn(
            "preference",
            delivery.error_message.lower(),
        )

    def test_muted_preference_suppresses_event(self):
        NotificationPreference.objects.create(
            user=self.requester,
            muted_event_types=[
                NotificationEventType.REQUEST_SUBMITTED
            ],
        )

        notify_users(
            recipients=[self.requester],
            event_type=(
                NotificationEventType.REQUEST_SUBMITTED
            ),
        )

        self.assertFalse(
            Notification.objects.filter(
                recipient=self.requester
            ).exists()
        )

    def test_preference_api_retrieves_and_updates(self):
        self.client.force_authenticate(self.requester)

        detail_response = self.client.get(
            "/api/v1/notifications/preferences/"
        )
        update_response = self.client.patch(
            "/api/v1/notifications/preferences/",
            {
                "email_enabled": True,
                "muted_event_types": [
                    NotificationEventType.SLA_WARNING
                ],
            },
            format="json",
        )

        self.assertEqual(
            detail_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            update_response.status_code,
            status.HTTP_200_OK,
        )
        self.requester.notification_preference.refresh_from_db()
        self.assertTrue(
            self.requester.notification_preference.email_enabled
        )
        self.assertEqual(
            self.requester.notification_preference.muted_event_types,
            [NotificationEventType.SLA_WARNING],
        )

    def test_submit_request_creates_workflow_notifications(self):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "erp_module": self.module,
                "voucher_type": self.voucher,
                "work_type": self.work_type,
                "voucher_number": "JV-NOT-001",
                "voucher_date": timezone.localdate(),
                "erp_email_date": timezone.localdate(),
                "description": (
                    "Notification workflow test."
                ),
                "reason_category": self.reason,
                "priority": self.priority,
                "amount": Decimal("100.00"),
            },
        )

        submit_request(
            draft=draft,
            user=self.requester,
        )

        requester_events = set(
            Notification.objects.filter(
                recipient=self.requester
            ).values_list("event_type", flat=True)
        )
        approver_events = set(
            Notification.objects.filter(
                recipient__in=[
                    self.director,
                    self.admin,
                ]
            ).values_list("event_type", flat=True)
        )

        self.assertIn(
            NotificationEventType.REQUEST_SUBMITTED,
            requester_events,
        )
        self.assertIn(
            NotificationEventType.APPROVAL_PENDING,
            approver_events,
        )
