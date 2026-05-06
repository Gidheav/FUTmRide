import logging
import random
import string
from django.conf import settings
from django.utils import timezone
from .models import OTPVerification, User

logger = logging.getLogger('apps.accounts')


import requests

class SMSService:
    @staticmethod
    def send(phone_number: str, message: str) -> None:
        api_key = getattr(settings, 'TERMII_API_KEY', None)
        sender_id = getattr(settings, 'TERMII_SENDER_ID', 'FUTMINNA')
        
        if not api_key:
            logger.warning('TERMII_API_KEY not set. Falling back to console log.')
            logger.info('SMS to %s: %s', phone_number, message)
            return

        url = "https://api.ng.termii.com/api/sms/send"
        payload = {
            "to": phone_number,
            "from": sender_id,
            "sms": message,
            "type": "plain",
            "channel": "generic",
            "api_key": api_key,
        }
        try:
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.info('SMS actually sent to %s via Termii', phone_number)
        except requests.exceptions.RequestException as e:
            logger.error('Failed to send SMS to %s: %s', phone_number, str(e))


class OTPService:
    @staticmethod
    def generate_code(length: int = 6) -> str:
        return ''.join(random.choices(string.digits, k=length))

    @classmethod
    def create_and_send(cls, user: User, purpose: str) -> OTPVerification:
        OTPVerification.objects.filter(
            user=user,
            purpose=purpose,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).update(is_used=True)

        code = cls.generate_code()
        expiry = timezone.now() + timezone.timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        otp = OTPVerification.objects.create(
            user=user,
            phone_number=user.phone_number,
            code=code,
            purpose=purpose,
            expires_at=expiry,
        )

        message = cls._compose_message(code, purpose)
        SMSService.send(str(user.phone_number), message)
        logger.info('otp_sent user_id=%s purpose=%s', str(user.id), purpose)
        return otp

    @staticmethod
    def _compose_message(code: str, purpose: str) -> str:
        expiry = settings.OTP_EXPIRY_MINUTES
        messages = {
            OTPVerification.Purpose.PHONE_VERIFICATION: (
                f'Your FUTMINNA Ride verification code is {code}. Valid for {expiry} minutes. Do not share.'
            ),
            OTPVerification.Purpose.LOGIN: (
                f'Your FUTMINNA Ride login code is {code}. Valid for {expiry} minutes.'
            ),
            OTPVerification.Purpose.PASSWORD_RESET: (
                f'Your FUTMINNA Ride password reset code is {code}. Valid for {expiry} minutes. Ignore if unsolicited.'
            ),
            OTPVerification.Purpose.TRANSACTION_PIN: (
                f'Your FUTMINNA Ride transaction code is {code}. Valid for {expiry} minutes.'
            ),
        }
        return messages.get(purpose, f'Your FUTMINNA Ride code is {code}.')

    @staticmethod
    def verify(phone_number: str, code: str, purpose: str) -> tuple:
        try:
            otp = OTPVerification.objects.filter(
                phone_number=phone_number,
                purpose=purpose,
                is_used=False,
                expires_at__gt=timezone.now(),
            ).latest('created_at')
        except OTPVerification.DoesNotExist:
            return False, 'No valid code found. Please request a new one.'

        if not otp.is_valid:
            return False, 'Code has expired or been used. Please request a new one.'

        if otp.code != code:
            otp.attempts += 1
            otp.save(update_fields=['attempts'])
            remaining = max(0, 3 - otp.attempts)
            logger.warning('otp_wrong_code phone=%s purpose=%s', phone_number, purpose)
            return False, f'Invalid code. {remaining} attempt(s) remaining.'

        otp.is_used = True
        otp.save(update_fields=['is_used'])
        logger.info('otp_verified phone=%s purpose=%s', phone_number, purpose)
        return True, 'Verified successfully.'