from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import (
    Campus,
    CampusAdminProfile,
    DriverProfile,
    StudentProfile,
    User,
    UserRole,
)
from apps.payments.models import WalletTransaction
from apps.verification.models import AccountVerification, DriverDocument
from .models import Ride, RideStatus
from .scheduled_models import (
    PassengerStatus,
    PricingTier,
    ScheduledRide,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    VehicleClass,
)
from .tasks import auto_close_expired_scheduled_rides


def make_campus(code='MAIN'):
    return Campus.objects.create(name=f'{code} Campus', code=code)


def make_student(
    phone='+2348011111111',
    email='aisha.m2302417@st.futminna.edu.ng',
    campus=None,
    wallet_balance='10000.00',
):
    user = User.objects.create_user(
        phone_number=phone,
        email=email,
        password='SecurePass123!',
        first_name='Aisha',
        last_name='Bello',
        role=UserRole.STUDENT,
        data_consent_given=True,
        is_phone_verified=True,
        is_verified=True,
    )
    StudentProfile.objects.create(
        user=user,
        campus=campus,
        wallet_balance=Decimal(str(wallet_balance)),
    )
    return user


def make_driver(phone='+2348022222222', approved=False, campus=None, vehicle_type='sedan'):
    user = User.objects.create_user(
        phone_number=phone,
        password='SecurePass123!',
        first_name='Musa',
        last_name='Ibrahim',
        role=UserRole.DRIVER,
        data_consent_given=True,
        is_active=True,
    )
    v_status = DriverProfile.VerificationStatus.APPROVED if approved else DriverProfile.VerificationStatus.PENDING
    DriverProfile.objects.create(
        user=user,
        vehicle_type=vehicle_type,
        vehicle_make='Toyota',
        vehicle_model='Camry',
        vehicle_year=2020,
        vehicle_color='Black',
        plate_number=f'PLT-{phone[-4:]}-XY',
        vehicle_seats=4,
        campus=campus,
        verification_status=v_status,
        maintenance_status=DriverProfile.MaintenanceStatus.ACTIVE,
        is_online=approved,
    )
    return user


def make_campus_admin(campus, phone='+2348000000001', email='admin@campus.edu.ng'):
    user = User.objects.create_user(
        phone_number=phone,
        email=email,
        password='SecurePass123!',
        first_name='Admin',
        last_name='User',
        role=UserRole.CAMPUS_ADMIN,
        is_verified=True,
    )
    CampusAdminProfile.objects.create(user=user, campus=campus)
    return user


RIDE_PAYLOAD = {
    'pickup_latitude': '9.0820',
    'pickup_longitude': '7.4891',
    'pickup_address': 'Gidan Kwano Main Gate',
    'dropoff_latitude': '9.0750',
    'dropoff_longitude': '7.4800',
    'dropoff_address': 'FUTMINNA Library',
    'vehicle_type_requested': 'sedan',
    'payment_method': 'wallet',
}


class RideBookingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.campus = make_campus()
        self.student = make_student(campus=self.campus)
        self.driver = make_driver(approved=True, campus=self.campus)
        login = self.client.post(reverse('auth-login'), {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.student_token = login.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.student_token}')

    def test_student_can_request_wallet_ride(self):
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('reference', res.data)
        self.assertEqual(res.data['status'], RideStatus.SEARCHING)
        self.assertTrue(res.data['is_paid'])

    def test_driver_can_accept_searching_ride(self):
        ride_res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        driver_login = self.client.post(reverse('auth-login'), {
            'phone_number': '+2348022222222',
            'password': 'SecurePass123!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {driver_login.data["access"]}')
        res = self.client.post(reverse('ride-driver-accept', kwargs={'ride_id': ride_res.data['id']}), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], RideStatus.DRIVER_ASSIGNED)
        self.assertEqual(res.data['driver']['id'], str(self.driver.id))

    def test_duplicate_active_ride_rejected(self):
        self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error']['code'], 'ACTIVE_RIDE_EXISTS')

    def test_driver_cannot_request_ride(self):
        driver_login = self.client.post(reverse('auth-login'), {
            'phone_number': '+2348022222222',
            'password': 'SecurePass123!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {driver_login.data["access"]}')
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_ride_request_rejected(self):
        self.client.credentials()
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_can_view_ride_history(self):
        self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        res = self.client.get(reverse('ride-student-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['pagination']['count'], 1)


class RideLifecycleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.campus = make_campus()
        self.student = make_student(campus=self.campus)
        self.driver = make_driver(approved=True, campus=self.campus)
        student_login = self.client.post(reverse('auth-login'), {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.student_token = student_login.data['access']
        driver_login = self.client.post(reverse('auth-login'), {
            'phone_number': '+2348022222222',
            'password': 'SecurePass123!',
        }, format='json')
        self.driver_token = driver_login.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.student_token}')
        ride_res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.ride_id = ride_res.data['id']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        self.client.post(reverse('ride-driver-accept', kwargs={'ride_id': self.ride_id}), format='json')

    def _advance(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        return self.client.post(reverse('ride-advance', kwargs={'ride_id': self.ride_id}), format='json')

    def test_driver_advances_ride_en_route(self):
        res = self._advance()
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], RideStatus.DRIVER_EN_ROUTE)

    def test_full_lifecycle_to_completion(self):
        for expected in [
            RideStatus.DRIVER_EN_ROUTE,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
            RideStatus.COMPLETED,
        ]:
            res = self._advance()
            self.assertEqual(res.data['status'], expected)
        ride = Ride.objects.get(id=self.ride_id)
        self.assertIsNotNone(ride.trip_completed_at)
        self.driver.driver_profile.refresh_from_db()
        self.assertEqual(self.driver.driver_profile.total_trips, 1)

    def test_student_can_cancel_assigned_ride(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.student_token}')
        res = self.client.post(
            reverse('ride-cancel', kwargs={'ride_id': self.ride_id}),
            {'reason': 'Changed my mind'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], RideStatus.CANCELLED_BY_STUDENT)

    def test_student_cannot_advance_ride(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.student_token}')
        res = self.client.post(reverse('ride-advance', kwargs={'ride_id': self.ride_id}), format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class RideStatusTransitionTestCase(TestCase):
    def test_invalid_transition_raises(self):
        student = make_student()
        ride = Ride.objects.create(
            reference='RDTEST001',
            student=student,
            status=RideStatus.COMPLETED,
            pickup_latitude='9.0820',
            pickup_longitude='7.4891',
            pickup_address='Gate',
            dropoff_latitude='9.0750',
            dropoff_longitude='7.4800',
            dropoff_address='Library',
        )
        with self.assertRaises(ValueError):
            ride.transition_to(RideStatus.SEARCHING)

    def test_valid_transition_succeeds(self):
        student = make_student()
        ride = Ride.objects.create(
            reference='RDTEST002',
            student=student,
            status=RideStatus.REQUESTED,
            pickup_latitude='9.0820',
            pickup_longitude='7.4891',
            pickup_address='Gate',
            dropoff_latitude='9.0750',
            dropoff_longitude='7.4800',
            dropoff_address='Library',
        )
        ride.transition_to(RideStatus.SEARCHING)
        self.assertEqual(ride.status, RideStatus.SEARCHING)


class ScheduledRideTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.campus = make_campus()
        self.other_campus = make_campus(code='OTHER')
        self.admin = make_campus_admin(self.campus)
        self.other_admin = make_campus_admin(
            self.other_campus,
            phone='+2348000000099',
            email='other-admin@campus.edu.ng',
        )
        self.driver = make_driver(phone='+2348000000010', approved=True, campus=self.campus)
        self.other_driver = make_driver(phone='+2348000000011', approved=True, campus=self.other_campus)
        self.student = make_student(
            phone='+2348000000002',
            email='student.m1234567@st.futminna.edu.ng',
            campus=self.campus,
            wallet_balance='1000.00',
        )

        admin_login = self.client.post(reverse('auth-login'), {
            'phone_number': '+2348000000001',
            'password': 'SecurePass123!',
        }, format='json')
        self.admin_token = admin_login.data['access']

        other_admin_login = self.client.post(reverse('auth-login'), {
            'phone_number': '+2348000000099',
            'password': 'SecurePass123!',
        }, format='json')
        self.other_admin_token = other_admin_login.data['access']

        student_login = self.client.post(reverse('auth-login'), {
            'email': 'student.m1234567@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.student_token = student_login.data['access']

        self.tomorrow = (timezone.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        self.base_payload = {
            'departure_date': self.tomorrow,
            'window_start': '08:00',
            'window_end': '08:30',
            'origin_address': 'Campus Gate',
            'origin_latitude': '9.082000',
            'origin_longitude': '7.489100',
            'destination_address': 'Library',
            'destination_latitude': '9.075000',
            'destination_longitude': '7.480000',
            'allowed_vehicle_types': [VehicleClass.SEDAN],
            'cargo_capacity_kg': 0,
            'standard_enabled': True,
            'standard_price': '100.00',
            'standing_enabled': False,
            'standing_price': '0.00',
            'premium_enabled': False,
            'premium_price': '0.00',
            'freight_enabled': False,
            'freight_price': '0.00',
            'stops': [
                {
                    'order': 1,
                    'name': 'Campus Gate',
                    'address': 'Campus Gate',
                    'latitude': '9.082000',
                    'longitude': '7.489100',
                    'is_pickup': True,
                    'is_dropoff': True,
                },
                {
                    'order': 2,
                    'name': 'Library',
                    'address': 'Library',
                    'latitude': '9.075000',
                    'longitude': '7.480000',
                    'is_pickup': True,
                    'is_dropoff': True,
                },
            ],
        }

    def admin_auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')

    def student_auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.student_token}')

    def create_scheduled_ride(self, payload=None):
        self.admin_auth()
        return self.client.post(reverse('scheduled-ride-create'), payload or self.base_payload, format='json')

    def test_create_scheduled_ride_valid(self):
        res = self.create_scheduled_ride()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ScheduledRide.objects.count(), 1)
        ride = ScheduledRide.objects.first()
        self.assertTrue(ride.reference.startswith('SR-'))
        self.assertEqual(ride.stops.count(), 2)

    def test_student_available_includes_parent_campus_ride(self):
        parent = Campus.objects.create(name='Federal University of Technology, Minna', code='FUTMINNA')
        child = Campus.objects.create(name='Gidan Kwano (FUTMINNA)', code='GK')
        self.admin.campus_admin_profile.campus = parent
        self.admin.campus_admin_profile.save(update_fields=['campus'])
        self.student.student_profile.campus = child
        self.student.student_profile.save(update_fields=['campus'])

        create_res = self.create_scheduled_ride()
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        self.student_auth()
        list_res = self.client.get(reverse('scheduled-ride-available'))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data['pagination']['count'], 1)
        self.assertEqual(list_res.data['results'][0]['id'], create_res.data['id'])

        detail_res = self.client.get(
            reverse('student-scheduled-ride-detail', kwargs={'ride_id': create_res.data['id']})
        )
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data['id'], create_res.data['id'])

    def test_student_available_keeps_boarding_parent_ride_visible(self):
        parent = Campus.objects.create(name='Federal University of Technology, Minna', code='FUTMINNA')
        child = Campus.objects.create(name='Gidan Kwano (FUTMINNA)', code='GK')
        self.admin.campus_admin_profile.campus = parent
        self.admin.campus_admin_profile.save(update_fields=['campus'])
        self.student.student_profile.campus = child
        self.student.student_profile.save(update_fields=['campus'])

        create_res = self.create_scheduled_ride()
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        ride = ScheduledRide.objects.get(id=create_res.data['id'])
        ride.status = ScheduledRideStatus.BOARDING
        ride.join_deadline = timezone.now() - timedelta(minutes=1)
        ride.save(update_fields=['status', 'join_deadline'])

        self.student_auth()
        list_res = self.client.get(reverse('scheduled-ride-available'))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data['pagination']['count'], 1)
        self.assertFalse(list_res.data['results'][0]['is_joinable'])

    def test_departure_window_exceeds_30min_rejected(self):
        payload = {**self.base_payload, 'window_end': '08:35'}
        res = self.create_scheduled_ride(payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Departure window cannot exceed 30 minutes', str(res.data))

    def test_past_start_rejected(self):
        payload = {
            **self.base_payload,
            'departure_date': timezone.localdate().isoformat(),
            'window_start': '00:01',
            'window_end': '00:30',
        }
        res = self.create_scheduled_ride(payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_departure_window_overlap_rejected(self):
        self.create_scheduled_ride()
        payload = {**self.base_payload, 'window_start': '08:15', 'window_end': '08:45'}
        res = self.create_scheduled_ride(payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('at least 30 minutes apart', str(res.data))

    def test_driver_overlap_rejected(self):
        payload = {**self.base_payload, 'assigned_driver': str(self.driver.id)}
        self.create_scheduled_ride(payload)
        payload2 = {
            **self.base_payload,
            'origin_address': 'Sports Complex',
            'destination_address': 'Hostel',
            'window_start': '08:15',
            'window_end': '08:45',
            'assigned_driver': str(self.driver.id),
        }
        res = self.create_scheduled_ride(payload2)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already has a scheduled ride', str(res.data))

    def test_invalid_stop_order_rejected(self):
        payload = {
            **self.base_payload,
            'stops': [
                {**self.base_payload['stops'][0], 'order': 1},
                {**self.base_payload['stops'][1], 'order': 3},
            ],
        }
        res = self.create_scheduled_ride(payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('contiguous', str(res.data))



    def test_invalid_assigned_driver_rejected(self):
        payload = {**self.base_payload, 'assigned_driver': str(self.other_driver.id)}
        res = self.create_scheduled_ride(payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('belong to this campus', str(res.data).lower())

    def test_student_join_debits_wallet(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        before = self.student.student_profile.wallet_balance
        self.student_auth()
        res = self.client.post(
            reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}),
            {'pricing_tier': PricingTier.STANDARD},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.student.student_profile.refresh_from_db()
        self.assertEqual(self.student.student_profile.wallet_balance, before - Decimal('100.00'))
        self.assertTrue(WalletTransaction.objects.filter(reference=res.data['payment_reference']).exists())

    def test_student_join_insufficient_wallet_rejected(self):
        self.student.student_profile.wallet_balance = Decimal('10.00')
        self.student.student_profile.save(update_fields=['wallet_balance'])
        res = self.create_scheduled_ride()
        self.student_auth()
        res = self.client.post(
            reverse('scheduled-ride-join', kwargs={'ride_id': res.data['id']}),
            {'pricing_tier': PricingTier.STANDARD},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ScheduledRidePassenger.objects.exists())

    def test_duplicate_student_join_rejected(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        self.student_auth()
        payload = {'pricing_tier': PricingTier.STANDARD}
        self.client.post(reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}), payload, format='json')
        res = self.client.post(reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}), payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unlimited_passengers_join(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        for i in range(3):
            student = make_student(
                phone=f'+234800000100{i}',
                email=f's{i}@st.edu.ng',
                campus=self.campus,
                wallet_balance='1000.00',
            )
            login = self.client.post(reverse('auth-login'), {
                'email': f's{i}@st.edu.ng',
                'password': 'SecurePass123!',
            }, format='json')
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
            res = self.client.post(
                reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}),
                {'pricing_tier': PricingTier.STANDARD},
                format='json',
            )
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(student.scheduled_ride_bookings.count(), 1)

        ride = ScheduledRide.objects.get(id=ride_id)
        self.assertEqual(ride.passenger_count, 3)

    def test_student_join_after_deadline_rejected(self):
        res = self.create_scheduled_ride()
        ride = ScheduledRide.objects.get(id=res.data['id'])
        ride.join_deadline = timezone.now() - timedelta(minutes=1)
        ride.status = ScheduledRideStatus.BOARDING
        ride.save(update_fields=['join_deadline', 'status'])

        self.student_auth()
        res = self.client.post(
            reverse('scheduled-ride-join', kwargs={'ride_id': str(ride.id)}),
            {'pricing_tier': PricingTier.STANDARD},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_leave_refunds_wallet(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        self.student_auth()
        self.client.post(
            reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}),
            {'pricing_tier': PricingTier.STANDARD},
            format='json',
        )
        self.student.student_profile.refresh_from_db()
        debited_balance = self.student.student_profile.wallet_balance
        res = self.client.post(reverse('scheduled-ride-leave', kwargs={'ride_id': ride_id}), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.student_profile.refresh_from_db()
        self.assertEqual(self.student.student_profile.wallet_balance, debited_balance + Decimal('100.00'))
        self.assertEqual(res.data['status'], PassengerStatus.CANCELLED)

    def test_admin_cancel_refunds_passengers(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        self.student_auth()
        self.client.post(
            reverse('scheduled-ride-join', kwargs={'ride_id': ride_id}),
            {'pricing_tier': PricingTier.STANDARD},
            format='json',
        )
        after_join = self.student.student_profile.wallet_balance

        self.admin_auth()
        res = self.client.post(reverse('scheduled-ride-cancel', kwargs={'ride_id': ride_id}), format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.student.student_profile.refresh_from_db()
        self.assertEqual(self.student.student_profile.wallet_balance, after_join + Decimal('100.00'))
        self.assertEqual(ScheduledRidePassenger.objects.get().status, PassengerStatus.CANCELLED)

    def test_campus_permission_isolation(self):
        res = self.create_scheduled_ride()
        ride_id = res.data['id']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_admin_token}')
        detail = self.client.get(reverse('scheduled-ride-detail', kwargs={'ride_id': ride_id}))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_auto_close_expired_scheduled_rides(self):
        res = self.create_scheduled_ride()
        ride = ScheduledRide.objects.get(id=res.data['id'])
        ride.join_deadline = timezone.now() - timedelta(minutes=1)
        ride.save(update_fields=['join_deadline'])
        processed = auto_close_expired_scheduled_rides()
        ride.refresh_from_db()
        self.assertEqual(processed, 1)
        self.assertEqual(ride.status, ScheduledRideStatus.BOARDING)


class TestToolsEndpointTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.campus = make_campus(code='TESTTOOLS')
        self.admin = make_campus_admin(
            self.campus,
            phone='+2348000099001',
            email='test-tools-admin@campus.edu.ng',
        )
        self.client.force_authenticate(user=self.admin)

    @override_settings(DEBUG=False, ENABLE_TEST_TOOLS=False)
    def test_mutations_are_blocked_when_test_tools_disabled(self):
        summary = self.client.get(reverse('test-tools-summary'))
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertFalse(summary.data['enabled'])

        res = self.client.post(reverse('test-tools-students-create'), {'count': 1}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(DEBUG=True, ENABLE_TEST_TOOLS=False)
    def test_bulk_create_and_join_flow(self):
        students = self.client.post(reverse('test-tools-students-create'), {'count': 3}, format='json')
        self.assertEqual(students.status_code, status.HTTP_200_OK)
        self.assertEqual(students.data['created'], 3)

        drivers = self.client.post(reverse('test-tools-drivers-create'), {'count': 2}, format='json')
        self.assertEqual(drivers.status_code, status.HTTP_200_OK)
        self.assertEqual(drivers.data['created'], 2)
        self.assertEqual(AccountVerification.objects.filter(status=AccountVerification.Status.APPROVED).count(), 2)
        self.assertEqual(DriverDocument.objects.filter(status=DriverDocument.DocumentStatus.APPROVED).count(), 10)

        rides = self.client.post(reverse('test-tools-rides-create'), {'count': 2}, format='json')
        self.assertEqual(rides.status_code, status.HTTP_200_OK)
        self.assertEqual(rides.data['created'], 2)
        ride_id = rides.data['records'][0]['id']

        joined = self.client.post(reverse('test-tools-rides-join'), {'ride_id': ride_id, 'count': 2}, format='json')
        self.assertEqual(joined.status_code, status.HTTP_200_OK)
        self.assertEqual(joined.data['joined'], 2)
        self.assertEqual(ScheduledRidePassenger.objects.filter(ride_id=ride_id).count(), 2)

        summary = self.client.get(reverse('test-tools-summary'))
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(summary.data['counts']['scheduled_rides'], 2)
