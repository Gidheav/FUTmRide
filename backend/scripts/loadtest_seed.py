"""
═══════════════════════════════════════════════════════════════════════════════════
 LR-Ride Load Test: Seed Script
 Creates 20 test drivers + 100 test students + 1 campus admin on the LIVE server.
 Runs as a Django management script (must be executed where Django can connect to DB).

 Usage (local with production DB):
   python backend/scripts/loadtest_seed.py

 Usage (Render shell):
   cd /opt/render/project/src/backend && python scripts/loadtest_seed.py

 This script is IDEMPOTENT — re-running it will skip existing accounts.
═══════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys
from pathlib import Path
from decimal import Decimal

# ── Django bootstrap ───────────────────────────────────────────────────────────
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')

import django
django.setup()

from django.db import transaction
from apps.accounts.models import User, UserRole, Campus, StudentProfile, DriverProfile

# ── Config ─────────────────────────────────────────────────────────────────────
PASSWORD = 'LoadTest2026!'
NUM_DRIVERS = 20
NUM_STUDENTS = 100

VEHICLE_TYPES = ['sedan', 'suv', 'minivan', 'tricycle', 'motorcycle']
VEHICLE_MAKES = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Nissan', 'Ford']
VEHICLE_MODELS = ['Corolla', 'Civic', 'Accent', 'Rio', 'Almera', 'Focus']
VEHICLE_COLORS = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Green']

# FUT Minna campus locations for realistic routes
FUT_LOCATIONS = [
    ('Main Gate', 9.5363, 6.4506),
    ('Gidan Kwano', 9.5323, 6.4526),
    ('Lecture Hall Complex', 9.5340, 6.4550),
    ('Library', 9.5310, 6.4540),
    ('Senate Building', 9.5350, 6.4510),
    ('Engineering Faculty', 9.5380, 6.4570),
    ('Science Faculty', 9.5290, 6.4530),
    ('Hostel Area', 9.5410, 6.4490),
    ('Market', 9.5250, 6.4480),
    ('Bosso Campus', 9.6175, 6.5508),
]


def get_or_create_campus():
    """Get or create the test campus."""
    campus, created = Campus.objects.get_or_create(
        code='FUTMX-GK',
        defaults={'name': 'FUTMINNA Gidan Kwano'}
    )
    if created:
        print(f'  ✅ Created campus: {campus.name}')
    else:
        print(f'  ♻️  Campus exists: {campus.name}')
    return campus


def create_drivers(campus):
    """Create 20 test drivers with approved verification (bypass)."""
    created_count = 0
    skipped_count = 0

    for i in range(1, NUM_DRIVERS + 1):
        phone = f'+23480100{i:05d}'
        if User.objects.filter(phone_number=phone).exists():
            skipped_count += 1
            continue

        with transaction.atomic():
            driver = User.objects.create_user(
                phone_number=phone,
                password=PASSWORD,
                first_name=f'TestDriver',
                last_name=f'D{i:03d}',
                role=UserRole.DRIVER,
                is_verified=True,
                is_phone_verified=True,
            )
            DriverProfile.objects.create(
                user=driver,
                vehicle_type=VEHICLE_TYPES[i % len(VEHICLE_TYPES)],
                vehicle_make=VEHICLE_MAKES[i % len(VEHICLE_MAKES)],
                vehicle_model=VEHICLE_MODELS[i % len(VEHICLE_MODELS)],
                vehicle_year=2018 + (i % 6),
                vehicle_color=VEHICLE_COLORS[i % len(VEHICLE_COLORS)],
                plate_number=f'LT-{i:03d}AA',
                vehicle_seats=4 + (i % 3),  # 4, 5, or 6 seats
                campus=campus,
                # ⚡ BYPASS: Set verification to APPROVED so drivers can create rides
                verification_status=DriverProfile.VerificationStatus.APPROVED,
                is_online=True,
                average_rating=Decimal(f'{3.5 + (i % 15) / 10:.2f}'),
            )
            created_count += 1

    print(f'  ✅ Drivers: {created_count} created, {skipped_count} already exist')


def create_students(campus):
    """Create 100 test students with wallet balance for boarding rides."""
    created_count = 0
    skipped_count = 0

    for i in range(1, NUM_STUDENTS + 1):
        phone = f'+23480200{i:05d}'
        if User.objects.filter(phone_number=phone).exists():
            skipped_count += 1
            continue

        with transaction.atomic():
            student = User.objects.create_user(
                phone_number=phone,
                password=PASSWORD,
                first_name=f'TestStudent',
                last_name=f'S{i:03d}',
                role=UserRole.STUDENT,
                is_verified=True,
                is_phone_verified=True,
            )
            StudentProfile.objects.create(
                user=student,
                matric_number=f'FUT/LT/{i:04d}',
                department='Computer Science',
                level=200 + (i % 4) * 100,
                campus=campus,
                # Give each student ₦5000 wallet balance for boarding
                wallet_balance=Decimal('5000.00'),
            )
            created_count += 1

    print(f'  ✅ Students: {created_count} created, {skipped_count} already exist')


def main():
    print('╔══════════════════════════════════════════════╗')
    print('║   LR-Ride Load Test — Seed Script            ║')
    print('║   Creating 20 Drivers + 100 Students          ║')
    print('╚══════════════════════════════════════════════╝')
    print()

    campus = get_or_create_campus()
    create_drivers(campus)
    create_students(campus)

    print()
    print('═══ CREDENTIALS ═══')
    print(f'  Drivers:  +23480100 00001 to +23480100 {NUM_DRIVERS:05d}')
    print(f'  Students: +23480200 00001 to +23480200 {NUM_STUDENTS:05d}')
    print(f'  Password: {PASSWORD}')
    print()
    print('✅ Seed complete!')


if __name__ == '__main__':
    main()
