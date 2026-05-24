"""
═══════════════════════════════════════════════════════════════════════════════════
 LR-Ride Load Test: Cleanup Script
 Removes all test accounts, their profiles, and any garage rides they created.
 Only touches accounts matching the load test phone patterns.

 Usage:
   python backend/scripts/loadtest_cleanup.py
═══════════════════════════════════════════════════════════════════════════════════
"""
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.production')

import django
django.setup()

from django.db import transaction
from apps.accounts.models import User
from apps.rides.garage_models import GarageRide


def main():
    print('╔══════════════════════════════════════════════╗')
    print('║   LR-Ride Load Test — Cleanup Script          ║')
    print('╚══════════════════════════════════════════════╝')
    print()

    # Find all load test users (drivers: +234801000..., students: +234802000...)
    test_drivers = User.objects.filter(phone_number__startswith='+23480100')
    test_students = User.objects.filter(phone_number__startswith='+23480200')

    # Find garage rides created by test drivers
    test_rides = GarageRide.objects.filter(driver__in=test_drivers)

    driver_count = test_drivers.count()
    student_count = test_students.count()
    ride_count = test_rides.count()

    print(f'  Found {driver_count} test drivers')
    print(f'  Found {student_count} test students')
    print(f'  Found {ride_count} test garage rides')
    print()

    if driver_count == 0 and student_count == 0:
        print('  Nothing to clean up!')
        return

    confirm = input('  ⚠️  Delete all? Type "yes" to confirm: ')
    if confirm.strip().lower() != 'yes':
        print('  Aborted.')
        return

    with transaction.atomic():
        # Delete garage ride passengers first (FK constraints)
        from apps.rides.garage_models import GarageRidePassenger
        passenger_count = GarageRidePassenger.objects.filter(
            garage_ride__in=test_rides
        ).delete()[0]

        # Delete garage rides
        ride_del = test_rides.delete()[0]

        # Delete users (cascades to profiles)
        driver_del = test_drivers.delete()[0]
        student_del = test_students.delete()[0]

    print(f'\n  ✅ Deleted:')
    print(f'     {driver_del} driver records')
    print(f'     {student_del} student records')
    print(f'     {ride_del} garage rides')
    print(f'     {passenger_count} passenger records')
    print('\n  Cleanup complete!')


if __name__ == '__main__':
    main()
