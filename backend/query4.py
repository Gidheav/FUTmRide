import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.accounts.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.rides.scheduled_views import StudentAvailableScheduledRidesView
import json

student = User.objects.filter(role='student').exclude(student_profile__campus__isnull=True).first()
if not student:
    student = User.objects.filter(role='student').first()

print("Using student:", student.email, "Campus:", getattr(student.student_profile, 'campus', None))

factory = APIRequestFactory()
request = factory.get('/api/v1/rides/scheduled/available/')
force_authenticate(request, user=student)

view = StudentAvailableScheduledRidesView.as_view()
response = view(request)

print("Status Code:", response.status_code)
print("Response Data:", repr(response.data))
