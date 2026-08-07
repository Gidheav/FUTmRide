from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from .models import Ride, RideStatus


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
