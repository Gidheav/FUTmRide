import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.rides.scheduled_serializers import ScheduledRideListSerializer
from apps.rides.models import ScheduledRide

ride = ScheduledRide.objects.order_by('-created_at').first()
print(repr(ScheduledRideListSerializer(ride).data))
