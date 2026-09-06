from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from .models import Ride, RideStatus
from .scheduled_models import ScheduledRidePassenger, ScheduledRideBusAssignment


def notify_student_ride_status(ride: Ride):
    status = ride.status

    if status == RideStatus.CANCELLED_BY_STUDENT:
        return None

    notification_type = Notification.NotificationType.GENERAL
    title = 'Ride update'
    body = 'Your ride status has changed.'

    if status == RideStatus.SEARCHING:
        notification_type = Notification.NotificationType.RIDE_REQUESTED
        title = 'Ride request recieved'
        body = 'Awaiting nearby driver to accept your Ride'
    elif status == RideStatus.DRIVER_ASSIGNED:
        notification_type = Notification.NotificationType.DRIVER_ASSIGNED
        driver_name = ride.driver.full_name if ride.driver else 'A driver'
        title = 'Driver found'
        body = f'{driver_name} accepted your ride request.'
    elif status == RideStatus.DRIVER_EN_ROUTE:
        notification_type = Notification.NotificationType.DRIVER_EN_ROUTE
        title = 'Driver en route'
        body = 'Your driver is on the way to your pickup location.'
    elif status == RideStatus.DRIVER_ARRIVED:
        notification_type = Notification.NotificationType.DRIVER_ARRIVED
        title = 'Driver arrived'
        body = 'Your driver has arrived at your pickup point.'
    elif status == RideStatus.IN_PROGRESS:
        notification_type = Notification.NotificationType.TRIP_STARTED
        title = 'Ride in progress'
        body = 'Your trip has started. Have a safe ride.'
    elif status == RideStatus.PENDING_COMPLETION:
        notification_type = Notification.NotificationType.GENERAL
        title = 'Trip Completion'
        body = 'Driver marked trip complete. Please confirm.'
    elif status == RideStatus.COMPLETED:
        notification_type = Notification.NotificationType.TRIP_COMPLETED
        title = 'Ride completed'
        body = 'Your trip has been completed successfully.'
    elif status == RideStatus.CANCELLED_BY_DRIVER:
        notification_type = Notification.NotificationType.RIDE_CANCELLED
        title = 'Ride cancelled by driver'
        body = 'Your driver cancelled this ride. Please request another ride.'
    elif status == RideStatus.CANCELLED_NO_DRIVER:
        notification_type = Notification.NotificationType.RIDE_CANCELLED
        title = 'No driver found'
        body = 'No nearby driver accepted this ride in time.'
    elif status == RideStatus.CANCELLED_NO_SHOW:
        notification_type = Notification.NotificationType.RIDE_CANCELLED
        title = 'Ride cancelled (no show)'
        body = 'This ride was cancelled because pickup did not happen in time.'

    payload = {
        'ride_id': str(ride.id),
        'ride_reference': ride.reference,
        'ride_status': status,
    }
    if ride.driver_id:
        payload['driver_id'] = str(ride.driver_id)

    return NotificationService.notify(
        user=ride.student,
        notification_type=notification_type,
        title=title,
        body=body,
        data=payload,
    )


def notify_student_checked_in(passenger: ScheduledRidePassenger):
    """Send notification to student when they are checked in by admin."""
    if not passenger.student:
        return None

    bus = passenger.bus_assignment
    if not bus:
        return None

    # Extract vehicle details
    driver_name = bus.driver.full_name if bus.driver else 'Driver'
    plate_number = None
    bus_label = bus.bus_label or 'Bus'

    # Get plate number from driver profile
    if bus.driver:
        try:
            driver_profile = bus.driver.driver_profile
            plate_number = driver_profile.plate_number
        except Exception:
            plate_number = None

    # Build vehicle identification string
    vehicle_id = f"{plate_number}" if plate_number else f"{bus_label}"
    if plate_number and bus_label:
        vehicle_id = f"{plate_number} ({bus_label})"

    # Get meeting location
    meeting_location = "Your pickup location"
    if passenger.boarding_stop:
        meeting_location = passenger.boarding_stop.name

    # Create notification
    title = 'You have been checked in'
    body = f'You are assigned to {vehicle_id}. Please be at {meeting_location} on time.'

    payload = {
        'passenger_id': str(passenger.id),
        'ride_id': str(passenger.ride.id),
        'bus_id': str(bus.id),
        'plate_number': plate_number,
        'bus_label': bus_label,
        'driver_name': driver_name,
        'meeting_location': meeting_location,
        'checked_in_at': passenger.checked_in_at.isoformat() if passenger.checked_in_at else None,
    }

    return NotificationService.notify(
        user=passenger.student,
        notification_type=Notification.NotificationType.STUDENT_CHECKED_IN,
        title=title,
        body=body,
        data=payload,
    )
