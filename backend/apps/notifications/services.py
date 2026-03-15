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

    @classmethod
    def send(cls, fcm_token: str, title: str, body: str, data: dict = None) -> bool:
        if not fcm_token:
            return False
        if settings.DEBUG:
            logger.info('PUSH [DEV] title=%s body=%s', title, body)
            return True
        try:
            resp = requests.post(
                cls.FCM_URL,
                json={
                    'to': fcm_token,
                    'notification': {'title': title, 'body': body},
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
        except Exception as e:
            logger.error('push_failed token=%s error=%s', fcm_token[:10], str(e))
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
        if user.fcm_token:
            PushNotificationService.send(user.fcm_token, title, body, data)
        return notif