import logging
import requests
from django.conf import settings

logger = logging.getLogger('apps.notifications')


class SMSService:
    @staticmethod
    def send(phone_number: str, message: str) -> bool:
        if settings.DEBUG:
            logger.info('SMS [DEV] to=%s msg=%s', phone_number, message)
            return True
        try:
            resp = requests.post(
                f'{settings.TERMII_BASE_URL}/sms/send',
                json={
                    'to': phone_number,
                    'from': settings.TERMII_SENDER_ID,
                    'sms': message,
                    'type': 'plain',
                    'channel': 'generic',
                    'api_key': settings.TERMII_API_KEY,
                },
                timeout=10,
            )
            resp.raise_for_status()
            logger.info('sms_sent to=%s', phone_number)
            return True
        except Exception as e:
            logger.error('sms_failed to=%s error=%s', phone_number, str(e))
            return False


class PushNotificationService:
    FCM_URL = 'https://fcm.googleapis.com/fcm/send'
    EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
    EXPO_PUSH_PREFIXES = ('ExpoPushToken[', 'ExponentPushToken[')
    RIDE_STATUS_CHANNEL_ID = 'ride-status-alerts'
    TITLE_PREVIEW_LENGTH = 48
    BODY_PREVIEW_LENGTH = 96

    @classmethod
    def _compact_text(cls, value: str, max_length: int) -> str:
        text = ' '.join(str(value or '').split())
        if len(text) <= max_length:
            return text
        return f'{text[:max(0, max_length - 3)].rstrip()}...'

    @classmethod
    def _compact_title_body(cls, title: str, body: str) -> tuple[str, str]:
        return (
            cls._compact_text(title, cls.TITLE_PREVIEW_LENGTH),
            cls._compact_text(body, cls.BODY_PREVIEW_LENGTH),
        )

    @classmethod
    def _is_expo_push_token(cls, push_token: str) -> bool:
        return push_token.startswith(cls.EXPO_PUSH_PREFIXES)

    @classmethod
    def _send_expo(cls, push_token: str, title: str, body: str, data: dict | None = None) -> bool:
        resp = requests.post(
            cls.EXPO_PUSH_URL,
            json={
                'to': push_token,
                'title': title,
                'body': body,
                'data': data or {},
                'channelId': cls.RIDE_STATUS_CHANNEL_ID,
                'priority': 'high',
                'sound': 'default',
            },
            headers={
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json() if resp.content else {}
        tickets = payload.get('data')
        if isinstance(tickets, dict):
            tickets = [tickets]
        if isinstance(tickets, list):
            for ticket in tickets:
                if isinstance(ticket, dict) and ticket.get('status') == 'error':
                    details = ticket.get('details') or {}
                    logger.error('expo_push_failed token=%s details=%s', push_token[:16], details)
                    return False
        if payload.get('errors'):
            logger.error('expo_push_failed token=%s errors=%s', push_token[:16], payload.get('errors'))
            return False
        return True

    @classmethod
    def _send_fcm_legacy(cls, push_token: str, title: str, body: str, data: dict | None = None) -> bool:
        resp = requests.post(
            cls.FCM_URL,
            json={
                'to': push_token,
                'priority': 'high',
                'notification': {
                    'title': title,
                    'body': body,
                    'android_channel_id': cls.RIDE_STATUS_CHANNEL_ID,
                    'sound': 'default',
                },
                'data': data or {},
            },
            headers={
                'Authorization': f'key={settings.FCM_SERVER_KEY}',
                'Content-Type': 'application/json',
            },
            timeout=10,
        )
        resp.raise_for_status()
        return True

    @classmethod
    def send(cls, push_token: str, title: str, body: str, data: dict = None) -> bool:
        if not push_token:
            return False
        push_title, push_body = cls._compact_title_body(title, body)
        if settings.DEBUG and not getattr(settings, 'ENABLE_PUSH_IN_DEBUG', False):
            logger.info('PUSH [DEV] title=%s body=%s', push_title, push_body)
            return True
        try:
            if cls._is_expo_push_token(push_token):
                return cls._send_expo(push_token, push_title, push_body, data)
            return cls._send_fcm_legacy(push_token, push_title, push_body, data)
        except Exception as e:
            logger.error('push_failed token=%s error=%s', push_token[:16], str(e))
            return False


class NotificationService:
    WALLET_CHANNEL_ID = 'wallet-alerts'
    RIDE_CHANNEL_ID = 'ride-status-alerts'
    WALLET_TYPES = {'payment_received', 'payment_debited'}

    # Maps each notification type to its UserSettings preference field.
    # If a type isn't listed here it has no dedicated toggle (always sends
    # when the global push_enabled is True).
    NOTIF_TYPE_PREF_FIELD = {
        'ride_requested':       'notif_ride_requested',
        'driver_assigned':      'notif_driver_assigned',
        'driver_en_route':      'notif_driver_en_route',
        'driver_arrived':       'notif_driver_arrived',
        'trip_started':         'notif_trip_started',
        'trip_completed':       'notif_trip_completed',
        'ride_cancelled':       'notif_ride_cancelled',
        'payment_received':     'notif_wallet_credit',
        'payment_debited':      'notif_wallet_debit',
        'shared_ride_joined':   'notif_ride_requested',
        'shared_ride_confirmed': 'notif_ride_requested',
        'shared_ride_dispatched': 'notif_trip_started',
        'shared_ride_cancelled':  'notif_ride_cancelled',
    }

    @staticmethod
    def notify(user, notification_type: str, title: str, body: str, data: dict = None) -> 'Notification | None':
        from .models import Notification

        # Normalise unknown types to GENERAL so the DB insert never fails
        valid_types = {c[0] for c in Notification.NotificationType.choices}
        safe_type = notification_type if notification_type in valid_types else Notification.NotificationType.GENERAL

        try:
            notif = Notification.objects.create(
                user=user,
                notification_type=safe_type,
                title=title,
                body=body,
                data=data or {},
            )
        except Exception as e:
            logger.error('notification_create_failed user=%s type=%s error=%s', user.id, notification_type, str(e))
            notif = None

        # ── Determine whether to send a push ────────────────────────────────
        # Step 1: check the global push_enabled master toggle.
        push_enabled = True
        try:
            if hasattr(user, 'settings'):
                push_enabled = getattr(user.settings, 'push_enabled', True)
        except Exception:
            push_enabled = True

        if not push_enabled:
            logger.info('push_skipped_disabled user=%s type=%s', user.id, notification_type)
            return notif

        # Step 2: check the granular per-type toggle (if one exists).
        pref_field = NotificationService.NOTIF_TYPE_PREF_FIELD.get(notification_type)
        if pref_field:
            try:
                granular_enabled = getattr(user.settings, pref_field, True)
            except Exception:
                granular_enabled = True
            if not granular_enabled:
                logger.info(
                    'push_skipped_pref user=%s type=%s pref=%s',
                    user.id, notification_type, pref_field,
                )
                return notif

        # Step 3: send the push.
        token = getattr(user, 'fcm_token', None)
        if not token:
            logger.info('push_skipped_no_token user=%s type=%s', user.id, notification_type)
            return notif

        channel = (
            NotificationService.WALLET_CHANNEL_ID
            if notification_type in NotificationService.WALLET_TYPES
            else NotificationService.RIDE_CHANNEL_ID
        )
        # Temporarily override channelId for wallet pushes
        _orig_channel = PushNotificationService.RIDE_STATUS_CHANNEL_ID
        PushNotificationService.RIDE_STATUS_CHANNEL_ID = channel
        try:
            sent = PushNotificationService.send(token, title, body, data)
            if not sent:
                logger.warning('push_not_sent user=%s type=%s', user.id, notification_type)
        finally:
            PushNotificationService.RIDE_STATUS_CHANNEL_ID = _orig_channel

        return notif

