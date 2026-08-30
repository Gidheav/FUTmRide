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

@shared_task(bind=True, name='rides.auto_confirm_pending_ride')
def auto_confirm_pending_ride(self, ride_id: str):
    import logging
    from apps.rides.models import Ride, RideStatus
    from apps.rides.services import finalize_ride_completion
    from apps.rides.notifications import notify_student_ride_status

    logger = logging.getLogger('apps.rides')
    try:
        ride = Ride.objects.get(id=ride_id)
    except Ride.DoesNotExist:
        return

    if ride.status == RideStatus.PENDING_COMPLETION:
        logger.info('auto_confirming_pending_ride ref=%s', ride.reference)
        try:
            ride.transition_to(RideStatus.COMPLETED)
            ride.save()
            finalize_ride_completion(ride)
            notify_student_ride_status(ride)
            logger.info('auto_confirmed_pending_ride_success ref=%s', ride.reference)
        except Exception as e:
            logger.error('auto_confirm_pending_ride_error ref=%s err=%s', ride.reference, str(e))


@shared_task(bind=True, name='rides.remind_scheduled_ride_passengers')
def remind_scheduled_ride_passengers(self):
    from django.utils import timezone
    import datetime
    from apps.rides.scheduled_models import ScheduledRide, ScheduledRideStatus, PassengerStatus
    from apps.notifications.services import NotificationService
    from apps.notifications.models import Notification
    
    now = timezone.now()
    cutoff_60m = now + datetime.timedelta(minutes=60)
    cutoff_15m = now + datetime.timedelta(minutes=15)
    
    # Needs a combined datetime for departure (using today since scheduled rides are typically daily or we check departure_date)
    # The models use departure_date and window_start.
    
    rides = ScheduledRide.objects.filter(
        status__in=[ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING],
        departure_date=now.date()
    )
    
    processed = 0
    for ride in rides:
        if not ride.window_start:
            continue
            
        departure_dt = timezone.make_aware(
            datetime.datetime.combine(ride.departure_date, ride.window_start),
            timezone.get_current_timezone()
        )
        
        # 60m reminder
        if not ride.reminder_60m_sent and now <= departure_dt <= cutoff_60m:
            passengers = ride.passengers.filter(status__in=[PassengerStatus.CONFIRMED, PassengerStatus.BOARDED])
            for pax in passengers:
                NotificationService.notify(
                    user=pax.student,
                    notification_type=Notification.NotificationType.GENERAL,
                    title='Upcoming Ride Reminder',
                    body=f'Your scheduled ride {ride.reference} is departing in about an hour.',
                    data={'ride_id': str(ride.id)}
                )
            ride.reminder_60m_sent = True
            ride.save(update_fields=['reminder_60m_sent'])
            processed += 1
            
        # 15m reminder
        if not ride.reminder_15m_sent and now <= departure_dt <= cutoff_15m:
            passengers = ride.passengers.filter(status__in=[PassengerStatus.CONFIRMED, PassengerStatus.BOARDED])
            for pax in passengers:
                NotificationService.notify(
                    user=pax.student,
                    notification_type=Notification.NotificationType.GENERAL,
                    title='Ride Departing Soon',
                    body=f'Your scheduled ride {ride.reference} is departing in 15 minutes. Please be at your pickup point.',
                    data={'ride_id': str(ride.id)}
                )
            ride.reminder_15m_sent = True
            ride.save(update_fields=['reminder_15m_sent'])
            processed += 1
            
    if processed:
        logger.info('remind_scheduled_ride_passengers reminders_sent=%d', processed)
    return processed


@shared_task(bind=True, name='rides.auto_resolve_stale_scheduled_rides')
def auto_resolve_stale_scheduled_rides(self):
    from django.utils import timezone
    import datetime
    from django.db import transaction
    from apps.rides.scheduled_models import (
        ScheduledRide, ScheduledRideStatus, 
        ScheduledRideBusAssignment, BusAssignmentStatus,
        ScheduledRidePassenger, PassengerStatus
    )
    from apps.payments.models import WalletTransaction
    from apps.payments.services import WalletService

    now = timezone.now()
    processed_rides = 0
    processed_buses = 0

    def get_ride_end_time(ride):
        if not ride.departure_date or not ride.window_end:
            return None
        return timezone.make_aware(
            datetime.datetime.combine(ride.departure_date, ride.window_end),
            timezone.get_current_timezone()
        )

    # Sweep 1: SCHEDULED rides past window_end + 6h
    stale_scheduled = ScheduledRide.objects.filter(
        status=ScheduledRideStatus.SCHEDULED,
        departure_date__lte=now.date()
    )
    for ride in stale_scheduled:
        end_time = get_ride_end_time(ride)
        if end_time and (now - end_time).total_seconds() > 6 * 3600:
            with transaction.atomic():
                locked_ride = ScheduledRide.objects.select_for_update().get(id=ride.id)
                if locked_ride.status == ScheduledRideStatus.SCHEDULED:
                    locked_ride.transition_to(ScheduledRideStatus.CANCELLED)
                    locked_ride.save(update_fields=['status'])
                    
                    # Refund active passengers
                    for pax in locked_ride.passengers.filter(status=PassengerStatus.CONFIRMED):
                        pax.status = PassengerStatus.CANCELLED
                        pax.save(update_fields=['status'])
                        if pax.amount_paid > 0:
                            WalletService.credit(
                                user=pax.student,
                                amount=pax.amount_paid,
                                source=WalletTransaction.Source.RIDE_REFUND,
                                narration=f"Refund: Ride {locked_ride.reference} cancelled",
                                ride_id=None,
                                scheduled_ride_id=str(locked_ride.id)
                            )
                    processed_rides += 1

    # Sweep 2: BOARDING rides past window_end + 4h with no departed bus
    stale_boarding = ScheduledRide.objects.filter(
        status=ScheduledRideStatus.BOARDING,
        departure_date__lte=now.date()
    )
    for ride in stale_boarding:
        end_time = get_ride_end_time(ride)
        if end_time and (now - end_time).total_seconds() > 4 * 3600:
            has_departed = ScheduledRideBusAssignment.objects.filter(
                ride=ride,
                status__in=[BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE, BusAssignmentStatus.ARRIVED, BusAssignmentStatus.COMPLETED]
            ).exists()
            if not has_departed:
                with transaction.atomic():
                    locked_ride = ScheduledRide.objects.select_for_update().get(id=ride.id)
                    if locked_ride.status == ScheduledRideStatus.BOARDING:
                        locked_ride.transition_to(ScheduledRideStatus.CANCELLED)
                        locked_ride.save(update_fields=['status'])
                        
                        # Refund active passengers
                        for pax in locked_ride.passengers.filter(status__in=[PassengerStatus.CONFIRMED, PassengerStatus.CHECKED_IN]):
                            pax.status = PassengerStatus.CANCELLED
                            pax.save(update_fields=['status'])
                            if pax.amount_paid > 0:
                                WalletService.credit(
                                    user=pax.student,
                                    amount=pax.amount_paid,
                                    source=WalletTransaction.Source.RIDE_REFUND,
                                    narration=f"Refund: Ride {locked_ride.reference} cancelled",
                                    ride_id=None,
                                    scheduled_ride_id=str(locked_ride.id)
                                )
                        processed_rides += 1

    # Sweep 3: DEPARTED/EN_ROUTE buses past departed_at + 8h
    cutoff_8h = now - datetime.timedelta(hours=8)
    stale_en_route_buses = ScheduledRideBusAssignment.objects.filter(
        status__in=[BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE],
        departed_at__lte=cutoff_8h
    )
    for bus in stale_en_route_buses:
        with transaction.atomic():
            locked_bus = ScheduledRideBusAssignment.objects.select_for_update().get(id=bus.id)
            if locked_bus.status in [BusAssignmentStatus.DEPARTED, BusAssignmentStatus.EN_ROUTE]:
                locked_bus.transition_to(BusAssignmentStatus.COMPLETED)
                locked_bus.save(update_fields=['status'])
                processed_buses += 1

    # Sweep 4: ARRIVED buses past arrived_at + 2h
    cutoff_2h = now - datetime.timedelta(hours=2)
    stale_arrived_buses = ScheduledRideBusAssignment.objects.filter(
        status=BusAssignmentStatus.ARRIVED,
        arrived_at__lte=cutoff_2h
    )
    for bus in stale_arrived_buses:
        with transaction.atomic():
            locked_bus = ScheduledRideBusAssignment.objects.select_for_update().get(id=bus.id)
            if locked_bus.status == BusAssignmentStatus.ARRIVED:
                locked_bus.transition_to(BusAssignmentStatus.COMPLETED)
                locked_bus.save(update_fields=['status'])
                processed_buses += 1

    # Complete parent rides if all their buses are completed
    # Find active rides where all buses are completed
    active_rides = ScheduledRide.objects.filter(
        status__in=[ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING, ScheduledRideStatus.DEPARTED]
    ).exclude(buses__isnull=True)
    
    for ride in active_rides:
        buses = ScheduledRideBusAssignment.objects.filter(ride=ride)
        if buses.exists() and all(b.status == BusAssignmentStatus.COMPLETED for b in buses):
            with transaction.atomic():
                locked_ride = ScheduledRide.objects.select_for_update().get(id=ride.id)
                if locked_ride.status in [ScheduledRideStatus.SCHEDULED, ScheduledRideStatus.BOARDING, ScheduledRideStatus.DEPARTED]:
                    locked_ride.transition_to(ScheduledRideStatus.COMPLETED)
                    locked_ride.save(update_fields=['status'])
                    processed_rides += 1

    if processed_rides > 0 or processed_buses > 0:
        logger.info('auto_resolve_stale_scheduled_rides processed_rides=%d processed_buses=%d', processed_rides, processed_buses)

    return {'processed_rides': processed_rides, 'processed_buses': processed_buses}
