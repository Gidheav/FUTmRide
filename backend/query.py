import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.rides.models import ScheduledRide
for r in ScheduledRide.objects.order_by("-created_at")[:5]:
    print(r.id, r.status, r.departure_date, r.join_deadline, getattr(r.campus, "id", None), getattr(r, "created_at", None))
