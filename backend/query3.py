import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from apps.rides.scheduled_serializers import ScheduledRideListSerializer
from apps.rides.models import ScheduledRide
import json
ride = ScheduledRide.objects.order_by('-created_at').first()
data = ScheduledRideListSerializer(ride).data
print("Attempting JSON dump...")
try:
    json.dumps(data)
    print("Success!")
except Exception as e:
    print("Failed!", str(e))
