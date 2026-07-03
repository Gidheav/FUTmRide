import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.utils import timezone
from apps.rides.scheduled_models import ScheduledRidePassenger
from apps.rides.garage_models import GarageRidePassenger

def test_queries():
    print("Testing queries...")
    today = timezone.now().date()
    
    try:
        scheduled_pax = ScheduledRidePassenger.objects.filter(
            ride__departure_date=today
        ).select_related('student', 'ride', 'boarding_stop', 'alighting_stop').order_by('-joined_at')
        
        print(f"Found {scheduled_pax.count()} scheduled passengers.")
        
        for p in scheduled_pax:
            if p.boarding_stop and p.alighting_stop:
                route_str = f"{p.boarding_stop.name} -> {p.alighting_stop.name}"
            else:
                route_str = f"{p.ride.origin_address} -> {p.ride.destination_address}"
            
            time_str = p.ride.window_start.strftime('%H:%M') if p.ride.window_start else ''
            
            print(f"Scheduled: {p.student.full_name}, {p.ticket_ref}, {route_str}, {time_str}")
            
    except Exception as e:
        print(f"Scheduled query failed: {type(e).__name__}: {str(e)}")

    try:
        garage_pax = GarageRidePassenger.objects.filter(
            garage_ride__created_at__date=today
        ).select_related('student', 'garage_ride').order_by('-boarded_at')
        
        print(f"Found {garage_pax.count()} garage passengers.")
        
        for p in garage_pax:
            route_str = f"{p.garage_ride.origin_address} -> {p.garage_ride.destination_address}"
            time_str = p.boarded_at.strftime('%Y-%m-%d %H:%M') if p.boarded_at else ''
            print(f"Garage: {p.student.full_name}, {p.ticket_ref}, {route_str}, {time_str}")
            
    except Exception as e:
        print(f"Garage query failed: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    test_queries()
