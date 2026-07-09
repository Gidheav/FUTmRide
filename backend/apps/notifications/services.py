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
    @staticmethod
    def notify(user, notification_type: str, title: str, body: str, data: dict = None):
        from .models import Notification
        notif = Notification.objects.create(
            user=user,
            notification_type=notification_type,
            title=title,
            body=body,
            data=data or {},
        )
        push_enabled = True
        try:
            if hasattr(user, 'settings'):
                push_enabled = user.settings.push_enabled
        except Exception:
            push_enabled = True
        if push_enabled and user.fcm_token:
            PushNotificationService.send(user.fcm_token, title, body, data)
        return notif
