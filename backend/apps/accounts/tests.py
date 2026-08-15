from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import AuditLog, MapSettings, User, StudentProfile, DriverProfile, OTPVerification, StudentSignupVerificationSession, UserRole
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone


class UserRegistrationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('auth-register')
        self.request_otp_url = reverse('auth-register-request-email-otp')
        self.verify_otp_url = reverse('auth-register-verify-email-otp')

    def _payload(self, **overrides):
        data = {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
            'confirm_password': 'SecurePass123!',
            'role': 'student',
        }
        data.update(overrides)
        return data

    def _request_student_signup_code(self, **overrides):
        return self.client.post(self.request_otp_url, self._payload(**overrides), format='json')

    def _verify_student_signup_code(self, email='aisha.m2302417@st.futminna.edu.ng'):
        pending = StudentSignupVerificationSession.objects.filter(email__iexact=email).latest('created_at')
        return self.client.post(self.verify_otp_url, {'email': email, 'code': pending.code}, format='json')

    def test_student_registration_succeeds(self):
        request_res = self._request_student_signup_code()
        self.assertEqual(request_res.status_code, status.HTTP_200_OK)

        verify_res = self._verify_student_signup_code()
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        verification_token = verify_res.data.get('verification_token')

        res = self.client.post(self.url, self._payload(verification_token=verification_token), format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('user_id', res.data)
        self.assertEqual(res.data['role'], 'student')
        user = User.objects.get(email='aisha.m2302417@st.futminna.edu.ng')
        self.assertTrue(hasattr(user, 'student_profile'))
        self.assertTrue(user.is_email_verified)

    def test_student_registration_without_verification_rejected(self):
        res = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_driver_registration_creates_driver_profile_placeholder(self):
        payload = self._payload(
            phone_number='+2348022222222',
            role='driver',
            email='',
            first_name='Musa',
            last_name='Ibrahim',
            data_consent_given=True,
        )
        res = self.client.post(self.url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['role'], 'driver')

    def test_registration_sends_otp(self):
        self.client.post(
            self.url,
            self._payload(
                role='driver',
                phone_number='+2348011111111',
                first_name='Aisha',
                last_name='Bello',
                data_consent_given=True,
                email='',
            ),
            format='json',
        )
        otp_count = OTPVerification.objects.filter(
            phone_number='+2348011111111',
            purpose=OTPVerification.Purpose.PHONE_VERIFICATION,
        ).count()
        self.assertEqual(otp_count, 1)

    def test_duplicate_phone_rejected(self):
        payload = self._payload(
            phone_number='+2348011111111',
            role='driver',
            email='',
            first_name='Aisha',
            last_name='Bello',
            data_consent_given=True,
        )
        self.client.post(self.url, payload, format='json')
        res = self.client.post(self.url, payload, format='json')
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
            self._payload(
                phone_number='+2348022222222',
                role='driver',
                email='',
                first_name='Musa',
                last_name='Ibrahim',
                data_consent_given=False,
            ),
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_role_not_allowed_via_registration(self):
        res = self.client.post(self.url, self._payload(role='admin'), format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class StudentSignupVerificationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.request_otp_url = reverse('auth-register-request-email-otp')
        self.verify_otp_url = reverse('auth-register-verify-email-otp')

    def _request_payload(self, **overrides):
        data = {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
            'confirm_password': 'SecurePass123!',
            'role': 'student',
        }
        data.update(overrides)
        return data

    def test_request_signup_otp_creates_pending_session(self):
        res = self.client.post(self.request_otp_url, self._request_payload(), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        pending_count = StudentSignupVerificationSession.objects.filter(
            email='aisha.m2302417@st.futminna.edu.ng'
        ).count()
        self.assertEqual(pending_count, 1)

    def test_verify_signup_otp_returns_verification_token(self):
        self.client.post(self.request_otp_url, self._request_payload(), format='json')
        pending = StudentSignupVerificationSession.objects.latest('created_at')
        res = self.client.post(self.verify_otp_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'code': pending.code,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('verification_token'))

    def test_verify_signup_otp_wrong_code_rejected(self):
        self.client.post(self.request_otp_url, self._request_payload(), format='json')
        res = self.client.post(self.verify_otp_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'code': '000000',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number='+2348011111111',
            email='aisha.m2302417@st.futminna.edu.ng',
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
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertIn('user', res.data)
        self.assertEqual(res.data['user']['role'], 'student')

    def test_login_wrong_password_rejected(self):
        res = self.client.post(self.login_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'WrongPassword!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user_rejected(self):
        res = self.client.post(self.login_url, {
            'email': 'ghost.m9999999@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_authenticated_me_endpoint(self):
        login_res = self.client.post(self.login_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
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
                'email': 'aisha.m2302417@st.futminna.edu.ng',
                'password': 'WrongPassword!',
            }, format='json')
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_locked)

    def test_logout_blacklists_token(self):
        login_res = self.client.post(self.login_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        token = login_res.data['access']
        refresh = login_res.data['refresh']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(reverse('auth-logout'), {'refresh': refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class IntegrationSettingsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            phone_number='+2348011111112',
            password='SecurePass123!',
            first_name='Admin',
            last_name='User',
            role=UserRole.ADMIN,
            data_consent_given=True,
        )
        self.status_url = reverse('auth-integrations-status')
        self.config_url = reverse('auth-integrations-config')

    def test_integration_status_returns_payload(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.status_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('payments', res.data)
        self.assertIn('notifications', res.data)
        self.assertIn('routing', res.data)
        self.assertIn('auth', res.data)

    def test_integration_config_patch_updates(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.config_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.patch(self.config_url, {
            'payments_enabled': False,
            'notifications_enabled': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['payments_enabled'], False)


class MapSettingsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('auth-settings-map')
        self.public_url = reverse('auth-settings-map-public')
        self.admin = User.objects.create_user(
            phone_number='+2348011111120',
            password='SecurePass123!',
            first_name='Map',
            last_name='Admin',
            role=UserRole.ADMIN,
            data_consent_given=True,
        )
        self.student = User.objects.create_user(
            phone_number='+2348011111121',
            email='map.student@st.futminna.edu.ng',
            password='SecurePass123!',
            first_name='Map',
            last_name='Student',
            role=UserRole.STUDENT,
            data_consent_given=True,
        )

    def test_admin_can_load_map_settings_without_mock_style_json(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('provider_readiness', res.data)
        self.assertIn('health_checks', res.data)
        self.assertNotIn('custom_style_json', res.data)

    def test_student_can_load_public_map_settings_only(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get(self.public_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('driver_clustering_enabled', res.data)
        self.assertNotIn('provider_readiness', res.data)
        self.assertNotIn('change_reason', res.data)

    def test_critical_patch_requires_change_reason(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(self.url, {'geofence_buffer_meters': 75}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('change_reason', res.data['error']['details'])

    def test_patch_updates_version_and_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(self.url, {
            'live_traffic_enabled': False,
            'demand_heatmaps_enabled': True,
            'driver_clustering_enabled': True,
            'refresh_interval_seconds': 30,
            'change_reason': 'Tune live fleet layers',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        settings_obj = MapSettings.load()
        self.assertEqual(settings_obj.config_version, 2)
        self.assertEqual(settings_obj.updated_by, self.admin)
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.Action.MAP_CONFIG_UPDATE).exists())


class SystemHealthStatusTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('auth-system-health-status')
        self.admin = User.objects.create_user(
            phone_number='+2348011111113',
            password='SecurePass123!',
            first_name='System',
            last_name='Admin',
            role=UserRole.ADMIN,
            data_consent_given=True,
        )
        self.student = User.objects.create_user(
            phone_number='+2348011111114',
            email='health.student@st.futminna.edu.ng',
            password='SecurePass123!',
            first_name='Health',
            last_name='Student',
            role=UserRole.STUDENT,
            data_consent_given=True,
        )

    @override_settings(
        UPTIMEROBOT_API_KEY='',
        CRON_JOB_ORG_API_KEY='',
        UPTIMEROBOT_MONITOR_IDS=[],
        CRON_JOB_ORG_JOB_IDS=[],
        SYSTEM_HEALTH_CACHE_SECONDS=0,
    )
    def test_system_health_returns_unconfigured_report(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['overall']['status'], 'unconfigured')
        self.assertIn('uptime_robot', res.data)
        self.assertIn('cron_job_org', res.data)
        self.assertFalse(res.data['uptime_robot']['configured'])
        self.assertFalse(res.data['cron_job_org']['configured'])

    def test_system_health_requires_admin_or_campus_admin(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class SeedAdminAccountsTestCase(TestCase):
    def test_seed_command_can_repair_campus_admin_password_and_unlock(self):
        user = User.objects.create_user(
            phone_number='+2348000000004',
            email='campus.admin@lrride.com',
            password='WrongStoredPass123!',
            first_name='Old',
            last_name='Admin',
            role=UserRole.CAMPUS_ADMIN,
            failed_login_attempts=5,
        )
        user.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        user.save(update_fields=['locked_until'])

        with override_settings(
            RESET_SEEDED_ADMIN_PASSWORDS=True,
            CAMPUS_ADMIN_SEED_PASSWORD='CampusAdminPass123!',
        ):
            call_command('seed_admin_accounts', verbosity=0)

        user.refresh_from_db()
        self.assertTrue(user.check_password('CampusAdminPass123!'))
        self.assertEqual(user.failed_login_attempts, 0)
        self.assertIsNone(user.locked_until)
        self.assertEqual(user.first_name, 'Campus')
        self.assertTrue(hasattr(user, 'campus_admin_profile'))


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


class PasswordResetTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number='+2348011111111',
            email='aisha.m2302417@st.futminna.edu.ng',
            password='SecurePass123!',
            first_name='Aisha',
            last_name='Bello',
            role=UserRole.STUDENT,
            data_consent_given=True,
        )
        StudentProfile.objects.create(user=self.user)
        self.request_url = reverse('auth-password-reset-request')
        self.confirm_url = reverse('auth-password-reset-confirm')

    def test_password_reset_request_accepts_email(self):
        res = self.client.post(self.request_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        otp = OTPVerification.objects.filter(
            user=self.user,
            email__iexact='aisha.m2302417@st.futminna.edu.ng',
            purpose=OTPVerification.Purpose.PASSWORD_RESET,
            is_used=False,
        ).first()
        self.assertIsNotNone(otp)

    def test_password_reset_confirm_with_email_updates_password(self):
        self.client.post(self.request_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
        }, format='json')
        otp = OTPVerification.objects.filter(
            user=self.user,
            email__iexact='aisha.m2302417@st.futminna.edu.ng',
            purpose=OTPVerification.Purpose.PASSWORD_RESET,
            is_used=False,
        ).latest('created_at')

        res = self.client.post(self.confirm_url, {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'code': otp.code,
            'new_password': 'NewSecurePass123!',
            'confirm_password': 'NewSecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewSecurePass123!'))

    def test_password_reset_request_requires_identifier(self):
        res = self.client.post(self.request_url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_confirm_with_phone_still_supported(self):
        self.client.post(self.request_url, {'phone_number': '+2348011111111'}, format='json')
        otp = OTPVerification.objects.filter(
            user=self.user,
            phone_number='+2348011111111',
            purpose=OTPVerification.Purpose.PASSWORD_RESET,
            is_used=False,
        ).latest('created_at')

        res = self.client.post(self.confirm_url, {
            'phone_number': '+2348011111111',
            'code': otp.code,
            'new_password': 'AnotherSecurePass123!',
            'confirm_password': 'AnotherSecurePass123!',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('AnotherSecurePass123!'))
