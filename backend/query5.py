import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.accounts.models import User
from apps.rides.models import ScheduledRide

student = User.objects.filter(role='student').exclude(student_profile__campus__isnull=True).first()
print("Student Campus ID:", student.student_profile.campus_id)

ride = ScheduledRide.objects.order_by('-created_at').first()
print("Ride Campus ID:", ride.campus_id)

from django.utils import timezone
print("Timezone Now:", timezone.now())
print("Ride join_deadline:", ride.join_deadline)
print("Is join_deadline > now?", ride.join_deadline > timezone.now())
print("Is status == SCHEDULED?", ride.status == 'scheduled')
