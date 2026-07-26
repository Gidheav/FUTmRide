from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from .models import Ride, RideStatus
from .shared_models import SharedRide, SharedRideRider


def has_blocking_active_ride(user) -> bool:
    """
    Returns True if the user has an active ride that should block them
    from booking another regular or shared ride.

    Allows booking if the only active ride is a scheduled ride more than
    5 minutes in the future.
    """
    threshold = timezone.now() + timedelta(minutes=5)
    
    # 1. Regular rides that are active and NOT scheduled > 5 mins in future
    blocking_regular = Ride.objects.filter(
        student=user,
        status__in=[
            RideStatus.REQUESTED, RideStatus.SEARCHING,
            RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE,
            RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS,
        ]
    ).filter(
        Q(scheduled_pickup_time__isnull=True) | Q(scheduled_pickup_time__lte=threshold)
    ).exists()

    if blocking_regular:
        return True

    # 2. Shared rides where user is an active participant
    blocking_shared = SharedRide.objects.filter(
        riders__user=user,
        riders__status__in=[SharedRideRider.Status.JOINED, SharedRideRider.Status.CONFIRMED],
        status__in=[
            SharedRide.Status.GATHERING,
            SharedRide.Status.MATCHING,
            SharedRide.Status.MATCHED,
            SharedRide.Status.IN_PROGRESS
        ]
    ).exists()

    return blocking_shared
