import logging
import secrets
import string
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import OTPVerification, StudentSignupVerificationSession, User

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
        return ''.join(secrets.choice(string.digits) for _ in range(length))

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
            OTPVerification.Purpose.TWO_FACTOR: (
                f'Your FUTMINNA Ride 2FA code is {code}. Valid for {expiry} minutes.'
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


class StudentSignupVerificationService:
    @staticmethod
    def generate_code(length: int = 6) -> str:
        return ''.join(secrets.choice(string.digits) for _ in range(length))

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(32)

    @classmethod
    def request_code(cls, email: str) -> StudentSignupVerificationSession:
        normalized_email = (email or '').strip().lower()
        code = cls.generate_code()
        expiry = timezone.now() + timezone.timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        session = StudentSignupVerificationSession.objects.create(
            email=normalized_email,
            code=code,
            code_expires_at=expiry,
        )

        subject, body = cls._compose_email(code)
        try:
            send_mail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [normalized_email],
                fail_silently=False,
            )
            logger.info('student_signup_code_sent email=%s session_id=%s', normalized_email, str(session.id))
        except Exception as exc:
            logger.error('student_signup_code_send_failed email=%s error=%s', normalized_email, str(exc))
            session.delete()
            raise RuntimeError('Unable to send verification code email at the moment.') from exc

        return session

    @staticmethod
    def _compose_email(code: str) -> tuple[str, str]:
        expiry = settings.OTP_EXPIRY_MINUTES
        return (
            'LR-Ride: Complete Your Student Signup',
            f'Your LR-Ride student signup verification code is: {code}\n\n'
            f'This code is valid for {expiry} minutes.\n'
            f'If you did not request this code, please ignore this email.\n\n'
            f'- LR-Ride Team',
        )

    @classmethod
    def verify_code(cls, email: str, code: str) -> tuple[bool, str, StudentSignupVerificationSession | None]:
        normalized_email = (email or '').strip().lower()
        try:
            session = StudentSignupVerificationSession.objects.filter(
                email__iexact=normalized_email,
                consumed_at__isnull=True,
            ).latest('created_at')
        except StudentSignupVerificationSession.DoesNotExist:
            return False, 'No pending signup verification found. Please request a new code.', None

        if session.code_expires_at <= timezone.now():
            return False, 'Code has expired. Please request a new code.', None

        max_attempts = getattr(settings, 'OTP_MAX_ATTEMPTS', 3)
        if session.attempts >= max_attempts:
            return False, 'Maximum attempts reached. Please request a new code.', None

        if session.code != code:
            session.attempts += 1
            session.save(update_fields=['attempts', 'updated_at'])
            remaining = max(0, max_attempts - session.attempts)
            return False, f'Invalid code. {remaining} attempt(s) remaining.', None

        session.is_verified = True
        session.verification_token = cls.generate_token()
        session.verification_token_expires_at = timezone.now() + timezone.timedelta(
            minutes=settings.OTP_EXPIRY_MINUTES
        )
        session.save(
            update_fields=[
                'is_verified',
                'verification_token',
                'verification_token_expires_at',
                'updated_at',
            ]
        )
        logger.info('student_signup_code_verified email=%s session_id=%s', normalized_email, str(session.id))
        return True, 'Email verified successfully.', session

    @staticmethod
    def get_verified_session(email: str, verification_token: str) -> StudentSignupVerificationSession | None:
        normalized_email = (email or '').strip().lower()
        now = timezone.now()

        try:
            return StudentSignupVerificationSession.objects.filter(
                email__iexact=normalized_email,
                verification_token=verification_token,
                is_verified=True,
                consumed_at__isnull=True,
                verification_token_expires_at__gt=now,
            ).latest('created_at')
        except StudentSignupVerificationSession.DoesNotExist:
            return None

    @staticmethod
    def mark_consumed(session: StudentSignupVerificationSession) -> None:
        session.consumed_at = timezone.now()
        session.save(update_fields=['consumed_at', 'updated_at'])


class EmailOTPService:
    """Send OTP codes via email for account settings changes."""

    @staticmethod
    def generate_code(length: int = 6) -> str:
        return ''.join(secrets.choice(string.digits) for _ in range(length))

    @classmethod
    def create_and_send(cls, user: 'User', purpose: str, email: str = None) -> 'OTPVerification':
        target_email = email or user.email
        if not target_email:
            raise ValueError('No email address available for OTP delivery.')

        # Invalidate previous unused OTPs for this purpose
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
            email=target_email,
            code=code,
            purpose=purpose,
            expires_at=expiry,
        )

        # Send via Django email
        subject, body = cls._compose_email(code, purpose)
        try:
            from django.core.mail import send_mail
            send_mail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [target_email],
                fail_silently=False,
            )
            logger.info('email_otp_sent user_id=%s email=%s purpose=%s', str(user.id), target_email, purpose)
        except Exception as exc:
            logger.error('email_otp_failed user_id=%s email=%s error=%s', str(user.id), target_email, str(exc))

        return otp

    @staticmethod
    def _compose_email(code: str, purpose: str) -> tuple:
        expiry = settings.OTP_EXPIRY_MINUTES
        if purpose == OTPVerification.Purpose.PASSWORD_RESET:
            return (
                'LR-Ride: Password Reset Verification',
                f'Your password reset verification code is: {code}\n\n'
                f'This code is valid for {expiry} minutes.\n'
                f'If you did not request this reset, secure your account immediately.\n\n'
                f'- LR-Ride Team',
            )
        if purpose == OTPVerification.Purpose.PASSWORD_CHANGE:
            return (
                'LR-Ride: Password Change Verification',
                f'Your password change verification code is: {code}\n\n'
                f'This code is valid for {expiry} minutes.\n'
                f'If you did not request this change, please ignore this email and secure your account.\n\n'
                f'- LR-Ride Team',
            )
        if purpose == OTPVerification.Purpose.TWO_FACTOR:
            return (
                'LR-Ride: Two-Factor Verification',
                f'Your two-factor verification code is: {code}\n\n'
                f'This code is valid for {expiry} minutes.\n'
                f'If you did not request this code, please secure your account.\n\n'
                f'- LR-Ride Team',
            )
        # EMAIL_CHANGE or fallback
        return (
            'LR-Ride: Email Change Verification',
            f'Your email change verification code is: {code}\n\n'
            f'This code is valid for {expiry} minutes.\n'
            f'If you did not request this change, please ignore this email.\n\n'
            f'- LR-Ride Team',
        )


    @staticmethod
    def verify(email: str, code: str, purpose: str) -> tuple:
        try:
            otp = OTPVerification.objects.filter(
                email__iexact=email,
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
            return False, f'Invalid code. {remaining} attempt(s) remaining.'

        otp.is_used = True
        otp.save(update_fields=['is_used'])
        logger.info('email_otp_verified email=%s purpose=%s', email, purpose)
        return True, 'Verified successfully.'
