#!/usr/bin/env python
"""
Script to fix seat_type for existing passengers based on their pricing_tier.
This ensures that passengers with standing pricing_tier have seat_type='standing'
and passengers with standard pricing_tier have seat_type='seated'.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.rides.scheduled_models import ScheduledRidePassenger, SeatType, PricingTier

def fix_seat_types():
    """Update seat_type for all passengers based on their pricing_tier."""
    
    # Count current mismatches
    standing_mismatch = ScheduledRidePassenger.objects.filter(
        pricing_tier=PricingTier.STANDING
    ).exclude(seat_type=SeatType.STANDING).count()
    
    standard_mismatch = ScheduledRidePassenger.objects.filter(
        pricing_tier=PricingTier.STANDARD
    ).exclude(seat_type=SeatType.SEATED).count()
    
    print(f"Found {standing_mismatch} standing passengers with incorrect seat_type")
    print(f"Found {standard_mismatch} standard passengers with incorrect seat_type")
    
    # Fix standing passengers
    updated_standing = ScheduledRidePassenger.objects.filter(
        pricing_tier=PricingTier.STANDING
    ).exclude(seat_type=SeatType.STANDING).update(seat_type=SeatType.STANDING)
    
    # Fix standard passengers
    updated_standard = ScheduledRidePassenger.objects.filter(
        pricing_tier=PricingTier.STANDARD
    ).exclude(seat_type=SeatType.SEATED).update(seat_type=SeatType.SEATED)
    
    print(f"Updated {updated_standing} passengers to standing seat_type")
    print(f"Updated {updated_standard} passengers to seated seat_type")
    print("Seat type fix completed successfully!")

if __name__ == '__main__':
    fix_seat_types()