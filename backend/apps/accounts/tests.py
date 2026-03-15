from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, StudentProfile, DriverProfile, OTPVerification, UserRole


class UserRegistrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('auth-register')

    def _payload(self, **overrides):
        data = {
            'phone_number': '+2348011111111',
            'first_name': 'Aisha',
            'last_name': 'Bello',
            'role': 'student',
            'password': 'SecurePass123!',
            'confirm_password': 'SecurePass123!',
            'data_consent_given': True,
        }
        data.update(overrides)
        return data

    def test_student_registration_succeeds(self):
        res = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('user_id', res.data)
        self.assertEqual(res.data['role'], 'student')
        user = User.objects.get(phone_number='+2348011111111')
        self.assertTrue(hasattr(user, 'student_profile'))

    def test_driver_registration_creates_driver_profile_placeholder(self):
        payload = self._payload(phone_number='+2348022222222', role='driver')
        res = self.client.post(self.url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['role'], 'driver')

    def test_registration_sends_otp(self):
        self.client.post(self.url, self._payload(), format='json')
        otp_count = OTPVerification.objects.filter(
            phone_number='+2348011111111',
            purpose=OTPVerification.Purpose.PHONE_VERIFICATION,
        ).count()
        self.assertEqual(otp_count, 1)

    def test_duplicate_phone_rejected(self):
        self.client.post(self.url, self._payload(), format='json')
        res = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_mismatched_passwords_rejected(self):
        res = self.client.post(
            self.url,
            self._payload(confirm_password='WrongPass123!'),
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_consent_rejected(self):
        res = self.client.post(
            self.url,
            self._payload(data_consent_given=False),
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_role_not_allowed_via_registration(self):
        res = self.client.post(self.url, self._payload(role='admin'), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number='+2348011111111',
            password='SecurePass123!',
            first_name='Aisha',
            last_name='Bello',
            role=UserRole.STUDENT,
            data_consent_given=True,
        )
        StudentProfile.objects.create(user=self.user)
        self.login_url = reverse('auth-login')

    def test_login_returns_tokens(self):
        res = self.client.post(self.login_url, {
            'phone_number': '+2348011111111',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user', res.data)
        self.assertEqual(res.data['user']['role'], 'student')

    def test_login_wrong_password_rejected(self):
        res = self.client.post(self.login_url, {
            'phone_number': '+2348011111111',
            'password': 'WrongPassword!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user_rejected(self):
        res = self.client.post(self.login_url, {
            'phone_number': '+2349999999999',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authenticated_me_endpoint(self):
        login_res = self.client.post(self.login_url, {
            'phone_number': '+2348011111111',
            'password': 'SecurePass123!',
        }, format='json')
        token = login_res.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.get(reverse('user-me'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['phone_number'], '+2348011111111')

    def test_unauthenticated_me_rejected(self):
        res = self.client.get(reverse('user-me'))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_account_lockout_after_five_failures(self):
        for _ in range(5):
            self.client.post(self.login_url, {
                'phone_number': '+2348011111111',
                'password': 'WrongPassword!',
            }, format='json')
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_locked)

    def test_logout_blacklists_token(self):
        login_res = self.client.post(self.login_url, {
            'phone_number': '+2348011111111',
            'password': 'SecurePass123!',
        }, format='json')
        token = login_res.data['access']
        refresh = login_res.data['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(reverse('auth-logout'), {'refresh': refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class OTPTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number='+2348011111111',
            password='SecurePass123!',
            first_name='Aisha',
            last_name='Bello',
            role=UserRole.STUDENT,
        )

    def test_otp_verify_marks_phone_verified(self):
        from .services import OTPService
        otp = OTPService.create_and_send(self.user, OTPVerification.Purpose.PHONE_VERIFICATION)
        res = self.client.post(reverse('auth-otp-verify'), {
            'phone_number': '+2348011111111',
            'code': otp.code,
            'purpose': 'phone_verification',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)
        self.assertTrue(self.user.is_verified)

    def test_wrong_otp_code_rejected(self):
        from .services import OTPService
        OTPService.create_and_send(self.user, OTPVerification.Purpose.PHONE_VERIFICATION)
        res = self.client.post(reverse('auth-otp-verify'), {
            'phone_number': '+2348011111111',
            'code': '000000',
            'purpose': 'phone_verification',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)