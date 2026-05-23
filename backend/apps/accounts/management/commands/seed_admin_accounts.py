"""
Management command: seed_admin_accounts

Creates the required admin accounts (Super Admin + Campus Admin) if they
don't already exist.  This is the **recommended production practice** —
admin accounts should NEVER be created via migrations (which are
schema-only), nor via ad-hoc shell sessions that can't be reproduced.

Usage:
    # Local dev
    python manage.py seed_admin_accounts

    # Production (Render)
    python manage.py seed_admin_accounts --settings=core.settings.production

This command is *idempotent*: running it multiple times is safe.
It will skip any account whose phone_number already exists.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import (
    Campus,
    CampusAdminProfile,
    DriverProfile,
    StudentProfile,
    User,
    UserRole,
)


# ── Accounts to seed ────────────────────────────────────────────────────────
# Add / remove entries here as needed.  Each dict maps directly to
# User.objects.create_user() kwargs + any extra post-creation steps.

ACCOUNTS = [
    # ──────────────── Super Admin ────────────────
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
    # ──────────────── Campus Admin ────────────────
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
        # Extra: link to a campus
        "_campus_code": "FUTMINNA",
        "_campus_name": "Federal University of Technology, Minna",
    },
    # ──────────────── Test Student ────────────────
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
    # ──────────────── Test Driver ────────────────
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
    help = "Seed required admin, campus-admin, and test accounts (idempotent)."

    def handle(self, *args, **options):
        created_count = 0
        skipped_count = 0

        with transaction.atomic():
            for acct in ACCOUNTS:
                # Pop internal keys that are not User fields
                campus_code = acct.pop("_campus_code", None)
                campus_name = acct.pop("_campus_name", None)

                phone = acct["phone_number"]
                role = acct["role"]

                if User.objects.filter(phone_number=phone).exists():
                    self.stdout.write(
                        self.style.WARNING(f"  SKIP  {role:14s}  {phone}  (already exists)")
                    )
                    skipped_count += 1
                    continue

                password = acct.pop("password")
                user = User.objects.create_user(password=password, **acct)

                # ── Post-creation profile linking ──
                campus = None
                if campus_code:
                    campus, _ = Campus.objects.get_or_create(
                        code=campus_code,
                        defaults={"name": campus_name or campus_code},
                    )

                if role == UserRole.CAMPUS_ADMIN and campus:
                    CampusAdminProfile.objects.get_or_create(
                        user=user, defaults={"campus": campus}
                    )

                if role == UserRole.STUDENT:
                    matric = None
                    if user.email:
                        local = user.email.split("@", 1)[0]
                        if "." in local:
                            matric = local.split(".")[-1].lower()
                    StudentProfile.objects.get_or_create(
                        user=user,
                        defaults={
                            "matric_number": matric,
                            "campus": campus,
                        },
                    )

                if role == UserRole.DRIVER:
                    DriverProfile.objects.get_or_create(
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

                self.stdout.write(
                    self.style.SUCCESS(f"  CREATE  {role:14s}  {phone}")
                )
                created_count += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count}, skipped {skipped_count}."
            )
        )
