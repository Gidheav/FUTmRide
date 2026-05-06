import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.development')
django.setup()

from apps.accounts.models import User, UserRole, Campus, CampusAdminProfile, StudentProfile, DriverProfile

print("Creating Campus...")
campus = Campus.objects.create(name='FUTMINNA Gidan Kwano', code='FUTMX-GK')

print("Creating Super Admin...")
admin = User.objects.create_superuser(
    phone_number='+2348000000000',
    password='AdminPass123!',
    first_name='Super',
    last_name='Admin',
)

print("Creating Campus Admin...")
c_admin = User.objects.create_user(
    phone_number='+2348000000004',
    password='CampusAdminPass123!',
    first_name='Campus',
    last_name='Admin',
    role=UserRole.CAMPUS_ADMIN,
    is_verified=True,
    is_phone_verified=True,
)
CampusAdminProfile.objects.create(user=c_admin, campus=campus)

print("Creating Student...")
student = User.objects.create_user(
    phone_number='+2348000000001',
    password='StudentPass123!',
    first_name='Test',
    last_name='Student',
    role=UserRole.STUDENT,
)
StudentProfile.objects.create(user=student, campus=campus)

print("Creating Driver...")
driver = User.objects.create_user(
    phone_number='+2348000000002',
    password='DriverPass123!',
    first_name='Test',
    last_name='Driver',
    role=UserRole.DRIVER,
)
DriverProfile.objects.create(
    user=driver,
    vehicle_type='sedan',
    vehicle_make='Toyota',
    vehicle_model='Corolla',
    vehicle_year=2015,
    vehicle_color='Silver',
    plate_number='KJA-123AA',
    campus=campus
)

print("Seed complete.")
