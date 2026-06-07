import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger('apps.rides')


@shared_task(bind=True, max_retries=3, name='rides.expire_unassigned_rides')
def expire_unassigned_rides(self):
    from apps.rides.models import Ride, RideStatus
    from apps.rides.notifications import notify_student_ride_status
    from django.conf import settings
    cutoff = timezone.now() - timezone.timedelta(seconds=settings.RIDE_REQUEST_TIMEOUT_SECONDS)
    stale = Ride.objects.filter(
        status=RideStatus.SEARCHING,
        requested_at__lt=cutoff,
    ).select_related('student', 'driver')
    stale_ids = list(stale.values_list('id', flat=True))
    count = stale.count()
    stale.update(
        status=RideStatus.CANCELLED_NO_DRIVER,
        cancellation_reason='No driver found within the request window.',
        cancelled_at=timezone.now(),
    )
    if count:
        for ride in Ride.objects.select_related('student', 'driver').filter(id__in=stale_ids):
            notify_student_ride_status(ride)
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


@shared_task(bind=True, name='rides.auto_mark_no_show')
def auto_mark_no_show(self):
    from decimal import Decimal
    from apps.rides.models import Ride, RideStatus
    from apps.rides.notifications import notify_student_ride_status
    from apps.payments.models import WalletTransaction
    from apps.payments.services import WalletService

    cutoff = timezone.now() - timezone.timedelta(minutes=5)
    rides = Ride.objects.filter(
        status=RideStatus.DRIVER_ARRIVED,
        scheduled_pickup_time__lte=cutoff,
        no_show_marked_at__isnull=True,
    ).select_related('student', 'driver')

    fee_rate = Decimal('0.40')
    processed = 0

    for ride in rides:
        total = Decimal(str(ride.total_fare or 0))
        fee_amount = (total * fee_rate) if total else Decimal('0.00')
        refund_amount = total - fee_amount

        with transaction.atomic():
            ride.transition_to(RideStatus.CANCELLED_NO_SHOW)
            ride.cancellation_reason = 'Student did not show up.'
            ride.no_show_fee_amount = fee_amount
            ride.no_show_marked_at = timezone.now()
            ride.save(update_fields=[
                'status',
                'cancellation_reason',
                'cancelled_at',
                'no_show_fee_amount',
                'no_show_marked_at',
            ])

            try:
                if ride.driver:
                    profile = ride.driver.driver_profile
                    profile.is_on_trip = False
                    profile.save(update_fields=['is_on_trip'])
            except Exception:
                pass

            if ride.payment_method == 'wallet' and ride.is_paid and total > 0:
                existing_refund = WalletTransaction.objects.filter(
                    ride=ride,
                    source=WalletTransaction.Source.RIDE_REFUND,
                    transaction_type=WalletTransaction.TransactionType.CREDIT,
                ).first()
                if not existing_refund and refund_amount > 0:
                    WalletService.credit(
                        user=ride.student,
                        amount=refund_amount,
                        source=WalletTransaction.Source.RIDE_REFUND,
                        narration=f'No-show refund — {ride.reference}',
                        ride=ride,
                        metadata={'no_show_fee_rate': str(fee_rate)},
                    )

                existing_driver_fee = WalletTransaction.objects.filter(
                    ride=ride,
                    source=WalletTransaction.Source.DRIVER_EARNING,
                    transaction_type=WalletTransaction.TransactionType.CREDIT,
                ).first()
                if not existing_driver_fee and ride.driver and fee_amount > 0:
                    WalletService.credit(
                        user=ride.driver,
                        amount=fee_amount,
                        source=WalletTransaction.Source.DRIVER_EARNING,
                        narration=f'No-show fee — {ride.reference}',
                        ride=ride,
                        metadata={'no_show_fee_rate': str(fee_rate)},
                    )

        notify_student_ride_status(ride)
        processed += 1

    if processed:
        logger.info('no_show_processed count=%d', processed)
    return processed


@shared_task(bind=True, name='accounts.cleanup_expired_otps')
def cleanup_expired_otps(self):
    from apps.accounts.models import OTPVerification
    deleted, _ = OTPVerification.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()
    logger.info('otp_cleanup deleted=%d', deleted)
    return deleted


@shared_task(bind=True, name='rides.auto_close_expired_scheduled_rides')
def auto_close_expired_scheduled_rides(self):
    from django.utils import timezone
    from apps.rides.scheduled_models import ScheduledRide, ScheduledRideStatus
    
    cutoff = timezone.now()
    rides = ScheduledRide.objects.filter(
        status=ScheduledRideStatus.SCHEDULED,
        join_deadline__lte=cutoff,
    )
    
    processed = 0
    for ride in rides:
        try:
            ride.transition_to(ScheduledRideStatus.BOARDING)
            ride.save(update_fields=['status'])
            # Note: We can add notification logic here to notify passengers that boarding has started
            processed += 1
        except Exception as e:
            logger.error('Failed to close scheduled ride %s: %s', ride.reference, e)

    if processed:
        logger.info('auto_close_expired_scheduled_rides count=%d', processed)
    return processed
