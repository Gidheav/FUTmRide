import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.rides.scheduled_models import ScheduledRidePassenger
from apps.rides.garage_models import GarageRidePassenger

for p in ScheduledRidePassenger.objects.filter(ticket_ref__isnull=True):
    p.save()
    
for p in GarageRidePassenger.objects.filter(ticket_ref__isnull=True):
    p.save()
    
print("Backfill complete.")
