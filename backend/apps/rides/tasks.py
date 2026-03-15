import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('apps.rides')


@shared_task(bind=True, max_retries=3, name='rides.expire_unassigned_rides')
def expire_unassigned_rides(self):
    from apps.rides.models import Ride, RideStatus
    from django.conf import settings
    cutoff = timezone.now() - timezone.timedelta(seconds=settings.RIDE_REQUEST_TIMEOUT_SECONDS)
    stale = Ride.objects.filter(
        status=RideStatus.SEARCHING,
        requested_at__lt=cutoff,
    )
    count = stale.count()
    stale.update(
        status=RideStatus.CANCELLED_NO_DRIVER,
        cancellation_reason='No driver found within the request window.',
        cancelled_at=timezone.now(),
    )
    if count:
        logger.info('expired_unassigned_rides count=%d', count)
    return count


@shared_task(bind=True, name='rides.notify_driver_assigned')
def notify_driver_assigned(self, ride_id: str):
    from apps.rides.models import Ride
    from apps.notifications.services import NotificationService
    from apps.notifications.models import Notification
    try:
        ride = Ride.objects.select_related('student', 'driver').get(id=ride_id)
    except Ride.DoesNotExist:
        return
    if ride.driver:
        NotificationService.notify(
            user=ride.student,
            notification_type=Notification.NotificationType.DRIVER_ASSIGNED,
            title='Driver assigned',
            body=f'{ride.driver.full_name} is on the way to pick you up.',
            data={'ride_id': ride_id, 'driver_id': str(ride.driver.id)},
        )


@shared_task(bind=True, name='rides.notify_trip_completed')
def notify_trip_completed(self, ride_id: str):
    from apps.rides.models import Ride
    from apps.notifications.services import NotificationService
    from apps.notifications.models import Notification
    from apps.payments.services import WalletService
    from apps.payments.models import WalletTransaction
    from decimal import Decimal
    try:
        ride = Ride.objects.select_related('student', 'driver').get(id=ride_id)
    except Ride.DoesNotExist:
        return

    NotificationService.notify(
        user=ride.student,
        notification_type=Notification.NotificationType.TRIP_COMPLETED,
        title='Trip completed',
        body=f'Your trip to {ride.dropoff_address} is complete. Total fare: NGN {ride.total_fare}.',
        data={'ride_id': ride_id},
    )

    if ride.driver and ride.driver_earnings and ride.payment_method == 'cash':
        WalletService.credit(
            user=ride.driver,
            amount=Decimal(str(ride.driver_earnings)),
            source=WalletTransaction.Source.DRIVER_EARNING,
            narration=f'Earnings from ride {ride.reference}',
            ride=ride,
        )
        NotificationService.notify(
            user=ride.driver,
            notification_type=Notification.NotificationType.PAYMENT_RECEIVED,
            title='Earnings credited',
            body=f'NGN {ride.driver_earnings} credited to your wallet for ride {ride.reference}.',
            data={'ride_id': ride_id},
        )


@shared_task(bind=True, name='accounts.cleanup_expired_otps')
def cleanup_expired_otps(self):
    from apps.accounts.models import OTPVerification
    deleted, _ = OTPVerification.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()
    logger.info('otp_cleanup deleted=%d', deleted)
    return deleted