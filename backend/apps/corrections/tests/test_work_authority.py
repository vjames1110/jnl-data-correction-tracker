from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.corrections.services.drafts import (
    create_draft,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import (
    Company,
    Department,
    Site,
)


def _create_user(employee_id, role, **extra):
    return User.objects.create_user(
        employee_id=employee_id,
        password="StrongPass123!",
        first_name=employee_id,
        role=role,
        account_status=AccountStatus.ACTIVE,
        **extra,
    )


def _create_profile(
    *,
    employee_id,
    site=None,
    department=None,
):
    return EmployeeProfile.objects.create(
        employee_id=employee_id,
        first_name=employee_id,
        role=UserRole.EMPLOYEE,
        site=site,
        department=department,
    )


class WorkAuthorityRuleTests(TestCase):
    """
    HO Work Authority, Site Work Authority and Root Cause Person are
    all EmployeeProfile references, so an employee never needs a
    login account (User) to be selectable for any of them. HO/Site
    eligibility is derived automatically from the profile's own site
    (and, for Site Work Authority, department): a Head Office
    (site_code "HO") employee is eligible as HO Work Authority,
    while a Site Work Authority must belong to the exact site and
    department the request itself is for.
    """

    def setUp(self):
        self.requester = _create_user(
            "WAREQ001",
            UserRole.USER,
        )
        self.company = Company.objects.create(
            company_code="JNL",
            company_name="Jhajharia Nirman Limited",
        )
        self.ho_site = Site.objects.create(
            company=self.company,
            site_code="HO",
            site_name="Head Office",
        )
        self.site = Site.objects.create(
            company=self.company,
            site_code="JPR",
            site_name="Jaipur Site",
        )
        self.other_site = Site.objects.create(
            company=self.company,
            site_code="BKN",
            site_name="Bikaner Site",
        )
        self.department = Department.objects.create(
            company=self.company,
            department_name="Finance",
        )
        self.other_department = (
            Department.objects.create(
                company=self.company,
                department_name="Stores",
            )
        )

        # None of these employees have a User account — they are
        # exactly the "Employee" role people who don't need a
        # dashboard login.
        self.ho_employee = _create_profile(
            employee_id="WAHO001",
            site=self.ho_site,
            department=self.department,
        )
        self.site_dept_employee = _create_profile(
            employee_id="WASD001",
            site=self.site,
            department=self.department,
        )
        self.other_dept_employee = _create_profile(
            employee_id="WAOD001",
            site=self.site,
            department=self.other_department,
        )
        self.other_site_employee = _create_profile(
            employee_id="WAOS001",
            site=self.other_site,
            department=self.department,
        )
        self.no_site_employee = _create_profile(
            employee_id="WANS001",
        )

    def test_ho_site_employee_accepted_as_ho_authority(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "ho_work_authority": (
                    self.ho_employee
                ),
            },
        )

        self.assertEqual(
            draft.ho_work_authority_id,
            self.ho_employee.id,
        )
        self.assertIsNone(
            draft.ho_work_authority.user_id
        )

    def test_non_ho_employee_rejected_as_ho_authority(
        self,
    ):
        with self.assertRaises(
            ValidationError
        ) as context:
            create_draft(
                requester=self.requester,
                data={
                    "site": self.site,
                    "department": self.department,
                    "ho_work_authority": (
                        self.site_dept_employee
                    ),
                },
            )

        self.assertIn(
            "ho_work_authority",
            context.exception.detail,
        )

    def test_employee_without_site_rejected_as_ho_authority(
        self,
    ):
        with self.assertRaises(
            ValidationError
        ) as context:
            create_draft(
                requester=self.requester,
                data={
                    "site": self.site,
                    "department": self.department,
                    "ho_work_authority": (
                        self.no_site_employee
                    ),
                },
            )

        self.assertIn(
            "ho_work_authority",
            context.exception.detail,
        )

    def test_matching_site_and_department_accepted_as_site_authority(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "site_work_authority": (
                    self.site_dept_employee
                ),
            },
        )

        self.assertEqual(
            draft.site_work_authority_id,
            self.site_dept_employee.id,
        )

    def test_mismatched_department_rejected_as_site_authority(
        self,
    ):
        with self.assertRaises(
            ValidationError
        ) as context:
            create_draft(
                requester=self.requester,
                data={
                    "site": self.site,
                    "department": self.department,
                    "site_work_authority": (
                        self.other_dept_employee
                    ),
                },
            )

        self.assertIn(
            "site_work_authority",
            context.exception.detail,
        )

    def test_mismatched_site_rejected_as_site_authority(
        self,
    ):
        with self.assertRaises(
            ValidationError
        ) as context:
            create_draft(
                requester=self.requester,
                data={
                    "site": self.site,
                    "department": self.department,
                    "site_work_authority": (
                        self.other_site_employee
                    ),
                },
            )

        self.assertIn(
            "site_work_authority",
            context.exception.detail,
        )

    def test_site_authority_rejected_when_department_not_yet_selected(
        self,
    ):
        with self.assertRaises(
            ValidationError
        ) as context:
            create_draft(
                requester=self.requester,
                data={
                    "site": self.site,
                    "site_work_authority": (
                        self.site_dept_employee
                    ),
                },
            )

        self.assertIn(
            "site_work_authority",
            context.exception.detail,
        )

    def test_root_cause_person_accepts_any_account_less_employee(
        self,
    ):
        draft = create_draft(
            requester=self.requester,
            data={
                "site": self.site,
                "department": self.department,
                "root_cause_person": (
                    self.no_site_employee
                ),
            },
        )

        self.assertEqual(
            draft.root_cause_person_id,
            self.no_site_employee.id,
        )
        self.assertIsNone(
            draft.root_cause_person.user_id
        )
