"""
Seed or repair required admin and test accounts.

Production usage:
    python manage.py seed_admin_accounts --settings=core.settings.production

Password repair is intentionally opt-in:
    RESET_SEEDED_ADMIN_PASSWORDS=true python manage.py seed_admin_accounts

Configured password environment variables:
    SUPER_ADMIN_SEED_PASSWORD
    CAMPUS_ADMIN_SEED_PASSWORD
    TEST_STUDENT_SEED_PASSWORD
    TEST_DRIVER_SEED_PASSWORD
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import (
    Campus,
    CampusAdminProfile,
    DriverProfile,
    StudentProfile,
    User,
    UserRole,
)


ACCOUNTS = [
    {
        "phone_number": "+2348000000000",
        "email": "admin@lrride.com",
        "first_name": "Super",
        "last_name": "Admin",
        "password": "AdminPass123!",
        "role": UserRole.ADMIN,
        "is_staff": True,
        "is_superuser": True,
        "is_verified": True,
        "data_consent_given": True,
    },
    {
        "phone_number": "+2348000000004",
        "email": "campus.admin@lrride.com",
        "first_name": "Campus",
        "last_name": "Admin",
        "password": "CampusAdminPass123!",
        "role": UserRole.CAMPUS_ADMIN,
        "is_staff": True,
        "is_superuser": False,
        "is_verified": True,
        "data_consent_given": True,
        "_campus_code": "FUTMINNA",
        "_campus_name": "Federal University of Technology, Minna",
    },
    {
        "phone_number": "+2348000000001",
        "email": "test.m0000001@st.futminna.edu.ng",
        "first_name": "Test",
        "last_name": "Student",
        "password": "StudentPass123!",
        "role": UserRole.STUDENT,
        "is_staff": False,
        "is_superuser": False,
        "is_verified": True,
        "data_consent_given": True,
        "_campus_code": "FUTMINNA",
        "_campus_name": "Federal University of Technology, Minna",
    },
    {
        "phone_number": "+2348000000002",
        "email": "driver@lrride.com",
        "first_name": "Test",
        "last_name": "Driver",
        "password": "DriverPass123!",
        "role": UserRole.DRIVER,
        "is_staff": False,
        "is_superuser": False,
        "is_verified": True,
        "data_consent_given": True,
    },
]


class Command(BaseCommand):
    help = "Seed or repair required admin, campus-admin, and test accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset seeded passwords to configured values.",
        )

    def _env_bool(self, name, default=False):
        if hasattr(settings, name):
            return bool(getattr(settings, name))
        env = getattr(settings, "env", None)
        if env:
            return env.bool(name, default=default)
        return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}

    def _env_value(self, name, default):
        if name and hasattr(settings, name):
            return getattr(settings, name)
        env = getattr(settings, "env", None)
        if env and name:
            return env(name, default=default)
        return os.environ.get(name, default) if name else default

    def _configured_password(self, role, default):
        env_names = {
            UserRole.ADMIN: "SUPER_ADMIN_SEED_PASSWORD",
            UserRole.CAMPUS_ADMIN: "CAMPUS_ADMIN_SEED_PASSWORD",
            UserRole.STUDENT: "TEST_STUDENT_SEED_PASSWORD",
            UserRole.DRIVER: "TEST_DRIVER_SEED_PASSWORD",
        }
        return self._env_value(env_names.get(role), default)

    def _ensure_campus(self, code, name):
        if not code:
            return None
        campus, _created = Campus.objects.get_or_create(
            code=code,
            defaults={"name": name or code},
        )
        if name and campus.name != name:
            campus.name = name
            campus.save(update_fields=["name", "updated_at"])
        return campus

    def _repair_profile(self, user, role, campus):
        if role == UserRole.CAMPUS_ADMIN and campus:
            profile, created = CampusAdminProfile.objects.get_or_create(
                user=user,
                defaults={"campus": campus},
            )
            if not created and profile.campus_id != campus.id:
                profile.campus = campus
                profile.save(update_fields=["campus"])

        if role == UserRole.STUDENT:
            matric = None
            if user.email:
                local = user.email.split("@", 1)[0]
                if "." in local:
                    matric = local.split(".")[-1].lower()
            profile, created = StudentProfile.objects.get_or_create(
                user=user,
                defaults={"matric_number": matric, "campus": campus},
            )
            update_fields = []
            if not created and campus and profile.campus_id != campus.id:
                profile.campus = campus
                update_fields.append("campus")
            if not created and matric and profile.matric_number != matric:
                profile.matric_number = matric
                update_fields.append("matric_number")
            if update_fields:
                profile.save(update_fields=update_fields)

        if role == UserRole.DRIVER:
            profile, created = DriverProfile.objects.get_or_create(
                user=user,
                defaults={
                    "vehicle_type": "sedan",
                    "vehicle_make": "Toyota",
                    "vehicle_model": "Corolla",
                    "vehicle_year": 2020,
                    "vehicle_color": "White",
                    "plate_number": "TEST-DRV-001",
                    "verification_status": DriverProfile.VerificationStatus.APPROVED,
                    "campus": campus,
                },
            )
            if not created and campus and profile.campus_id != campus.id:
                profile.campus = campus
                profile.save(update_fields=["campus"])

    def handle(self, *args, **options):
        created_count = 0
        repaired_count = 0
        reset_count = 0
        reset_passwords = options["reset_passwords"] or self._env_bool(
            "RESET_SEEDED_ADMIN_PASSWORDS",
            default=False,
        )

        with transaction.atomic():
            for source_acct in ACCOUNTS:
                acct = source_acct.copy()
                campus_code = acct.pop("_campus_code", None)
                campus_name = acct.pop("_campus_name", None)
                phone = acct["phone_number"]
                role = acct["role"]
                password = self._configured_password(role, acct.pop("password"))
                campus = self._ensure_campus(campus_code, campus_name)

                user = User.objects.filter(phone_number=phone).first()
                if user:
                    changed_fields = []
                    for field, value in acct.items():
                        if field == "phone_number":
                            continue
                        if getattr(user, field) != value:
                            setattr(user, field, value)
                            changed_fields.append(field)

                    if reset_passwords and not user.check_password(password):
                        user.set_password(password)
                        changed_fields.append("password")
                        reset_count += 1

                    if role in {UserRole.ADMIN, UserRole.CAMPUS_ADMIN}:
                        if user.failed_login_attempts or user.locked_until:
                            user.failed_login_attempts = 0
                            user.locked_until = None
                            changed_fields.extend(["failed_login_attempts", "locked_until"])

                    if changed_fields:
                        user.updated_at = timezone.now()
                        changed_fields.append("updated_at")
                        user.save(update_fields=list(dict.fromkeys(changed_fields)))
                        repaired_count += 1

                    self._repair_profile(user, role, campus)
                    self.stdout.write(
                        self.style.WARNING(f"  REPAIR  {role:14s}  {phone}  (already exists)")
                    )
                    continue

                user = User.objects.create_user(password=password, **acct)
                self._repair_profile(user, role, campus)
                self.stdout.write(self.style.SUCCESS(f"  CREATE  {role:14s}  {phone}"))
                created_count += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count}, repaired {repaired_count}, password resets {reset_count}."
            )
        )
