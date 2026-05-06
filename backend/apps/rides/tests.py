from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, StudentProfile, DriverProfile, UserRole
from .models import Ride, RideStatus


def make_student(phone='+2348011111111', email='aisha.m2302417@st.futminna.edu.ng'):
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
    StudentProfile.objects.create(user=user)
    return user


def make_driver(phone='+2348022222222', approved=False):
    user = User.objects.create_user(
        phone_number=phone,
        password='SecurePass123!',
        first_name='Musa',
        last_name='Ibrahim',
        role=UserRole.DRIVER,
        data_consent_given=True,
    )
    v_status = DriverProfile.VerificationStatus.APPROVED if approved else DriverProfile.VerificationStatus.PENDING
    DriverProfile.objects.create(
        user=user,
        vehicle_type='sedan',
        vehicle_make='Toyota',
        vehicle_model='Camry',
        vehicle_year=2020,
        vehicle_color='Black',
        plate_number=f'PLT-{phone[-4:]}-XY',
        verification_status=v_status,
        is_online=approved,
    )
    return user


RIDE_PAYLOAD = {
    'pickup_latitude': '9.0820',
    'pickup_longitude': '7.4891',
    'pickup_address': 'Gidan Kwano Main Gate',
    'dropoff_latitude': '9.0750',
    'dropoff_longitude': '7.4800',
    'dropoff_address': 'FUTMINNA Library',
    'vehicle_type_requested': 'sedan',
    'payment_method': 'cash',
}


class RideBookingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = make_student()
        self.driver = make_driver(approved=True)
        login = self.client.post(reverse('auth-login'), {
            'email': 'aisha.m2302417@st.futminna.edu.ng',
            'password': 'SecurePass123!',
        }, format='json')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')

    def test_student_can_request_ride(self):
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertIn(res.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])
        self.assertIn('reference', res.data)

    def test_ride_assigned_when_approved_driver_online(self):
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.data['status'], RideStatus.DRIVER_ASSIGNED)
        self.assertIsNotNone(res.data['driver'])

    def test_ride_cancelled_no_driver_when_none_available(self):
        self.driver.driver_profile.is_online = False
        self.driver.driver_profile.save()
        res = self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        self.assertEqual(res.data['status'], RideStatus.CANCELLED_NO_DRIVER)

    def test_duplicate_active_ride_rejected(self):
        self.client.post(reverse('ride-request'), RIDE_PAYLOAD, format='json')
        second_driver = make_driver(phone='+2348033333333', approved=True)
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
        self.student = make_student()
        self.driver = make_driver(approved=True)
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

    def _advance(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        return self.client.post(
            reverse('ride-advance', kwargs={'ride_id': self.ride_id}),
            format='json',
        )

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
        res = self.client.post(
            reverse('ride-advance', kwargs={'ride_id': self.ride_id}),
            format='json',
        )
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