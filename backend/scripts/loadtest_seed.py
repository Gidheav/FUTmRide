"""
LR-Ride Load Test: Seed Script
Creates 20 test drivers + 100 test students on the LIVE server.
Runs as a Django management script (must be executed where Django can connect to DB).

Usage (Render start command):
  python scripts/loadtest_seed.py && daphne -b 0.0.0.0 -p $PORT core.asgi:application

This script is IDEMPOTENT -- re-running it will skip existing accounts.
"""
import os
import sys
from pathlib import Path
from decimal import Decimal

# -- Django bootstrap --
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')

import django
django.setup()

from django.db import models, transaction
from apps.accounts.models import User, UserRole, Campus, StudentProfile, DriverProfile

# -- Config --
PASSWORD = 'LoadTest2026!'
NUM_DRIVERS = 20
NUM_STUDENTS = 100

VEHICLE_TYPES = ['sedan', 'suv', 'minivan', 'tricycle', 'motorcycle']
VEHICLE_MAKES = ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Nissan', 'Ford']
VEHICLE_MODELS = ['Corolla', 'Civic', 'Accent', 'Rio', 'Almera', 'Focus']
VEHICLE_COLORS = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Green']


def get_or_create_campus():
    campus, created = Campus.objects.get_or_create(
        code='FUTMX-GK',
        defaults={'name': 'FUTMINNA Gidan Kwano'}
    )
    status = 'Created' if created else 'Exists'
    print(f'  [{status}] Campus: {campus.name}')
    return campus


def create_drivers(campus):
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
                vehicle_seats=4 + (i % 3),
                campus=campus,
                verification_status=DriverProfile.VerificationStatus.APPROVED,
                is_online=True,
                average_rating=Decimal(f'{3.5 + (i % 15) / 10:.2f}'),
            )
            created_count += 1

    print(f'  Drivers: {created_count} created, {skipped_count} already exist')


def create_students(campus):
    created_count = 0
    skipped_count = 0

    for i in range(1, NUM_STUDENTS + 1):
        email = f'loadtest.m{i:07d}@st.futminna.edu.ng'
        phone = f'+23480200{i:05d}'

        with transaction.atomic():
            # Check if student exists by phone or email
            student = User.objects.filter(models.Q(phone_number=phone) | models.Q(email=email)).first()
            
            if student:
                # Update existing student with email
                if not student.email:
                    student.email = email
                    student.is_email_verified = True
                    student.save(update_fields=['email', 'is_email_verified'])
                skipped_count += 1
                continue

            student = User.objects.create_user(
                phone_number=phone,
                email=email,
                password=PASSWORD,
                first_name=f'TestStudent',
                last_name=f'S{i:03d}',
                role=UserRole.STUDENT,
                is_verified=True,
                is_phone_verified=True,
                is_email_verified=True,
            )
            StudentProfile.objects.create(
                user=student,
                matric_number=f'FUT/LT/{i:04d}',
                department='Computer Science',
                level=200 + (i % 4) * 100,
                campus=campus,
                wallet_balance=Decimal('5000.00'),
            )
            created_count += 1

    print(f'  Students: {created_count} created, {skipped_count} already exist')


def main():
    print('=== LR-Ride Load Test Seed ===')
    print(f'  Creating {NUM_DRIVERS} Drivers + {NUM_STUDENTS} Students')
    print()

    campus = get_or_create_campus()
    create_drivers(campus)
    create_students(campus)

    print()
    print('=== CREDENTIALS ===')
    print(f'  Drivers:  phone +2348010000001 to +23480100{NUM_DRIVERS:05d}  pwd: {PASSWORD}')
    print(f'  Students: email loadtest.m0000001@st.futminna.edu.ng to loadtest.m{NUM_STUDENTS:07d}@st.futminna.edu.ng  pwd: {PASSWORD}')
    print()
    print('Seed complete!')


if __name__ == '__main__':
    main()
