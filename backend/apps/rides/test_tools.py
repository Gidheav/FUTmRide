import datetime
import random
import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (
    Campus,
    CampusAdminProfile,
    DriverProfile,
    StudentProfile,
    User,
    UserRole,
)
from apps.accounts.permissions import IsAdminOrCampusAdmin
from apps.payments.models import WalletTransaction
from apps.payments.services import generate_reference
from apps.verification.models import AccountVerification, DriverDocument
from .models import Ride, RideStatus, VehicleType, PaymentMethod
from .scheduled_models import (
    PassengerStatus,
    PricingTier,
    ScheduledRide,
    ScheduledRideBusAssignment,
    ScheduledRidePassenger,
    ScheduledRideStatus,
    ScheduledRideStop,
    SeatType,
    VehicleClass,
)
from .scheduled_serializers import generate_scheduled_reference
from .scheduled_views import scope_admin_queryset


TEST_MARKER = '[TEST_TOOL]'
STUDENT_EMAIL_PREFIX = 'bulktest.student.'
DRIVER_EMAIL_PREFIX = 'bulktest.driver.'
ADMIN_EMAIL_PREFIX = 'bulktest.admin.'
MAX_BULK_COUNT = 2000
DEFAULT_PASSWORD = 'TestPass2026!'
DEFAULT_PASSWORD_HASH = make_password(DEFAULT_PASSWORD)

ROUTES = [
    (
        'FUT Minna Main Gate',
        '9.654120',
        '6.526350',
        'Senate Building',
        '9.651780',
        '6.529840',
    ),
    (
        'Gidan Kwano Hostel',
        '9.648910',
        '6.523710',
        'School of ICT',
        '9.657330',
        '6.531100',
    ),
    (
        'Library Complex',
        '9.652410',
        '6.527970',
        'Engineering Workshop',
        '9.659050',
        '6.535140',
    ),
    (
        'Bosso Campus Gate',
        '9.616180',
        '6.548210',
        'Gidan Kwano Main Gate',
        '9.654120',
        '6.526350',
    ),
    (
        'Student Centre',
        '9.650770',
        '6.525900',
        'Sports Complex',
        '9.646300',
        '6.532470',
    ),
]

VEHICLE_PROFILES = [
    {
        'size': VehicleClass.SEDAN,
        'label': 'Sedan',
        'seated': 4,
        'standing': 0,
        'driver_type': DriverProfile.VehicleType.SEDAN,
    },
    {
        'size': VehicleClass.MPV,
        'label': 'MPV',
        'seated': 6,
        'standing': 0,
        'driver_type': DriverProfile.VehicleType.MPV,
    },
    {
        'size': VehicleClass.MINIBUS,
        'label': 'Minibus',
        'seated': 14,
        'standing': 4,
        'driver_type': DriverProfile.VehicleType.MINIBUS,
    },
    {
        'size': VehicleClass.COACH,
        'label': 'Coach',
        'seated': 48,
        'standing': 18,
        'driver_type': DriverProfile.VehicleType.COACH,
    },
]

DRIVER_VEHICLES = [
    (DriverProfile.VehicleType.SEDAN, 'Toyota', 'Corolla', 4),
    (DriverProfile.VehicleType.MPV, 'Toyota', 'Sienna', 6),
    (DriverProfile.VehicleType.MINIBUS, 'Toyota', 'HiAce Shuttle', 14),
    (DriverProfile.VehicleType.COACH, 'Marcopolo', 'Bus', 48),
    (DriverProfile.VehicleType.TRICYCLE, 'Bajaj', 'RE Compact', 3),
    (DriverProfile.VehicleType.MOTORBIKE, 'Bajaj', 'Boxer', 1),
]


def test_tools_enabled():
    return bool(settings.DEBUG or getattr(settings, 'ENABLE_TEST_TOOLS', False))


def require_test_tools():
    if test_tools_enabled():
        return None
    return Response(
        {
            'detail': (
                'Test tools are disabled. Set ENABLE_TEST_TOOLS=true only in a '
                'safe test environment, or run with DEBUG=True locally.'
            )
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def parse_count(data, default=1):
    try:
        count = int(data.get('count', default))
    except (TypeError, ValueError):
        return None, 'Count must be a number.'
    if count < 1:
        return None, 'Count must be at least 1.'
    if count > MAX_BULK_COUNT:
        return None, f'Count cannot exceed {MAX_BULK_COUNT} per request.'
    return count, None


def get_request_campus(user):
    if user.role == UserRole.CAMPUS_ADMIN:
        try:
            return user.campus_admin_profile.campus
        except CampusAdminProfile.DoesNotExist:
            return None
    return Campus.objects.filter(is_active=True).order_by('name').first()


def random_token():
    return uuid.uuid4().hex[:10]


def random_phone(prefix):
    for _ in range(20):
        phone = f'{prefix}{random.randint(1000000, 9999999)}'
        if not User.objects.filter(phone_number=phone).exists():
            return phone
    return f'{prefix}{uuid.uuid4().int % 10000000:07d}'


def test_students_qs(campus=None):
    qs = User.objects.filter(role=UserRole.STUDENT, email__startswith=STUDENT_EMAIL_PREFIX)
    if campus:
        qs = qs.filter(student_profile__campus=campus)
    return qs


def test_drivers_qs(campus=None):
    qs = User.objects.filter(role=UserRole.DRIVER, email__startswith=DRIVER_EMAIL_PREFIX)
    if campus:
        qs = qs.filter(driver_profile__campus=campus)
    return qs


def test_admins_qs(campus=None):
    qs = User.objects.filter(role=UserRole.CAMPUS_ADMIN, email__startswith=ADMIN_EMAIL_PREFIX)
    if campus:
        qs = qs.filter(campus_admin_profile__campus=campus)
    return qs


def test_rides_qs(user):
    return scope_admin_queryset(
        user,
        ScheduledRide.objects.filter(admin_notes__contains=TEST_MARKER),
    )


def test_ondemand_rides_qs():
    return Ride.objects.filter(cancellation_reason__contains=TEST_MARKER)


def ensure_students(count, campus):
    created = []
    errors = []
    for index in range(count):
        token = random_token()
        email = f'{STUDENT_EMAIL_PREFIX}{token}@st.futminna.edu.ng'
        phone = random_phone('+234708')
        try:
            with transaction.atomic():
                user = User.objects.create(
                    phone_number=phone,
                    email=email,
                    password=DEFAULT_PASSWORD_HASH,
                    first_name='TestStudent',
                    last_name=token[:6].upper(),
                    role=UserRole.STUDENT,
                    is_verified=True,
                    is_phone_verified=True,
                    is_email_verified=True,
                    data_consent_given=True,
                    data_consent_timestamp=timezone.now(),
                )
                StudentProfile.objects.create(
                    user=user,
                    matric_number=f'BT{token[:8].upper()}',
                    department=random.choice(['Computer Science', 'Transport Management', 'Engineering', 'Mathematics']),
                    level=random.choice([100, 200, 300, 400, 500]),
                    campus=campus,
                    wallet_balance=Decimal('100000.00'),
                )
                created.append({'id': str(user.id), 'email': email, 'phone_number': phone})
        except Exception as exc:
            errors.append({'index': index + 1, 'message': str(exc)})
    return created, errors


def ensure_drivers(count, campus, reviewer):
    created = []
    errors = []
    for index in range(count):
        token = random_token()
        email = f'{DRIVER_EMAIL_PREFIX}{token}@lrride.test'
        phone = random_phone('+234709')
        vehicle_type, make, model, seats = random.choice(DRIVER_VEHICLES)
        try:
            with transaction.atomic():
                user = User.objects.create(
                    phone_number=phone,
                    email=email,
                    password=DEFAULT_PASSWORD_HASH,
                    first_name='TestDriver',
                    last_name=token[:6].upper(),
                    role=UserRole.DRIVER,
                    is_verified=True,
                    is_phone_verified=True,
                    is_email_verified=True,
                    data_consent_given=True,
                    data_consent_timestamp=timezone.now(),
                )
                profile = DriverProfile.objects.create(
                    user=user,
                    vehicle_type=vehicle_type,
                    vehicle_make=make,
                    vehicle_model=model,
                    vehicle_year=random.randint(2016, 2025),
                    vehicle_color=random.choice(['White', 'Silver', 'Black', 'Blue', 'Green']),
                    plate_number=f'TST-{token[:7].upper()}',
                    vehicle_seats=seats,
                    campus=campus,
                    maintenance_status=DriverProfile.MaintenanceStatus.ACTIVE,
                    verification_status=DriverProfile.VerificationStatus.APPROVED,
                    verification_notes=f'{TEST_MARKER} auto-approved test driver',
                    verified_at=timezone.now(),
                    verified_by=reviewer,
                    is_online=random.choice([True, True, False]),
                    wallet_balance=Decimal('25000.00'),
                    average_rating=Decimal(str(random.choice(['4.50', '4.70', '4.85', '5.00']))),
                )
                AccountVerification.objects.create(
                    driver=user,
                    full_name=user.full_name,
                    age=random.randint(24, 48),
                    state_of_origin=random.choice(['niger', 'lagos', 'kano', 'kaduna', 'fct']),
                    address='Test address generated by LR Ride test tools',
                    nin_number=str(random.randint(10000000000, 99999999999)),
                    nin_scan='test-tools/auto-approved-nin.txt',
                    status=AccountVerification.Status.APPROVED,
                    admin_notes=f'{TEST_MARKER} auto-approved account verification',
                    reviewed_by=reviewer,
                    reviewed_at=timezone.now(),
                )
                for doc_type in DriverDocument.DocumentType.values:
                    DriverDocument.objects.create(
                        driver=user,
                        document_type=doc_type,
                        file=f'test-tools/{doc_type}.txt',
                        status=DriverDocument.DocumentStatus.APPROVED,
                        admin_notes=f'{TEST_MARKER} auto-approved driver document',
                        reviewed_by=reviewer,
                        reviewed_at=timezone.now(),
                    )
                created.append({
                    'id': str(user.id),
                    'email': email,
                    'phone_number': phone,
                    'vehicle_type': profile.vehicle_type,
                    'plate_number': profile.plate_number,
                })
        except Exception as exc:
            errors.append({'index': index + 1, 'message': str(exc)})
    return created, errors


def ensure_admins(count, campus):
    created = []
    errors = []
    for index in range(count):
        token = random_token()
        email = f'{ADMIN_EMAIL_PREFIX}{token}@lrride.test'
        phone = random_phone('+234707')
        try:
            with transaction.atomic():
                user = User.objects.create(
                    phone_number=phone,
                    email=email,
                    password=DEFAULT_PASSWORD_HASH,
                    first_name='TestAdmin',
                    last_name=token[:6].upper(),
                    role=UserRole.CAMPUS_ADMIN,
                    is_verified=True,
                    is_phone_verified=True,
                    is_email_verified=True,
                    data_consent_given=True,
                    data_consent_timestamp=timezone.now(),
                )
                CampusAdminProfile.objects.create(user=user, campus=campus)
                created.append({'id': str(user.id), 'email': email, 'phone_number': phone})
        except Exception as exc:
            errors.append({'index': index + 1, 'message': str(exc)})
    return created, errors


def make_stops(ride, origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng):
    midpoint_count = random.randint(0, 2)
    stop_rows = [
        ScheduledRideStop(
            ride=ride,
            order=1,
            name=origin_name,
            address=origin_name,
            latitude=origin_lat,
            longitude=origin_lng,
            estimated_arrival_offset_min=0,
            is_pickup=True,
            is_dropoff=True,
        )
    ]
    for offset in range(midpoint_count):
        stop_rows.append(
            ScheduledRideStop(
                ride=ride,
                order=offset + 2,
                name=random.choice(['Lecture Theatre Stop', 'Clinic Stop', 'Cafeteria Stop', 'Hostel Junction']),
                address='Generated intermediate campus stop',
                latitude=Decimal(origin_lat) + Decimal(str(random.uniform(-0.005, 0.005))),
                longitude=Decimal(origin_lng) + Decimal(str(random.uniform(-0.005, 0.005))),
                estimated_arrival_offset_min=8 + (offset * 6),
                is_pickup=True,
                is_dropoff=True,
            )
        )
    stop_rows.append(
        ScheduledRideStop(
            ride=ride,
            order=len(stop_rows) + 1,
            name=dest_name,
            address=dest_name,
            latitude=dest_lat,
            longitude=dest_lng,
            estimated_arrival_offset_min=20 + (midpoint_count * 6),
            is_pickup=True,
            is_dropoff=True,
        )
    )
    ScheduledRideStop.objects.bulk_create(stop_rows)


def create_bus_assignments(ride, profile, campus):
    driver_pool = list(
        test_drivers_qs(campus)
        .filter(driver_profile__verification_status=DriverProfile.VerificationStatus.APPROVED)
        .order_by('?')[:3]
    )
    bus_count = 1 if profile['size'] in [VehicleClass.SEDAN, VehicleClass.MPV, VehicleClass.MINIBUS] else random.randint(1, 3)
    created = []
    for order in range(1, bus_count + 1):
        seated = profile['seated']
        standing = profile['standing']
        if bus_count > 1:
            seated = max(10, int(seated * random.uniform(0.65, 1.0)))
            standing = int(standing * random.uniform(0.5, 1.0))
        bus = ScheduledRideBusAssignment.objects.create(
            ride=ride,
            driver=driver_pool[(order - 1) % len(driver_pool)] if driver_pool else None,
            bus_label=f'{profile["label"]} {order}',
            order=order,
            seated_capacity=seated,
            standing_capacity=standing,
            admin_notes=f'{TEST_MARKER} generated bus assignment',
        )
        created.append(bus)
    return created


def ensure_rides(count, campus, creator):
    created = []
    errors = []
    batch_size = 100
    for batch_start in range(0, count, batch_size):
        batch_count = min(batch_size, count - batch_start)
        try:
            with transaction.atomic():
                for index in range(batch_start, batch_start + batch_count):
                    route = random.choice(ROUTES)
                    profile = random.choice(VEHICLE_PROFILES)
                    days_ahead = random.randint(1, 14)
                    start_hour = random.randint(7, 18)
                    start_minute = random.choice([0, 30])
                    window_start = datetime.time(start_hour, start_minute)
                    end_dt = datetime.datetime.combine(datetime.date.today(), window_start) + datetime.timedelta(minutes=25)
                    window_end = end_dt.time()
                    departure_date = timezone.localdate() + datetime.timedelta(days=days_ahead)
                    join_deadline = timezone.make_aware(datetime.datetime.combine(departure_date, window_end)) - datetime.timedelta(minutes=5)
                    standard_price = Decimal(str(random.choice([100, 150, 200, 250, 300])))
                    standing_enabled = profile['size'] in [VehicleClass.MINIBUS, VehicleClass.COACH] and random.choice([True, False])
                    premium_enabled = profile['size'] in [VehicleClass.SEDAN, VehicleClass.MPV] and random.choice([True, False])
                    freight_enabled = profile['size'] in [VehicleClass.MPV, VehicleClass.MINIBUS, VehicleClass.COACH] and random.choice([True, False])
                    cargo_capacity = random.choice([0, 50, 100, 250]) if freight_enabled else 0
                    
                    driver = (
                        test_drivers_qs(campus)
                        .filter(driver_profile__vehicle_type=profile['driver_type'])
                        .order_by('?')
                        .first()
                    )
                    ride = ScheduledRide.objects.create(
                        reference=generate_scheduled_reference(),
                        created_by=creator,
                        campus=campus,
                        departure_date=departure_date,
                        window_start=window_start,
                        window_end=window_end,
                        join_deadline=join_deadline,
                        origin_address=route[0],
                        origin_latitude=route[1],
                        origin_longitude=route[2],
                        destination_address=route[3],
                        destination_latitude=route[4],
                        destination_longitude=route[5],
                        allowed_vehicle_types=[profile['size']],
                        cargo_capacity_kg=cargo_capacity,
                        assigned_driver=driver,
                        standard_enabled=True,
                        standard_price=standard_price,
                        standing_enabled=standing_enabled,
                        standing_price=standard_price * Decimal('0.70') if standing_enabled else Decimal('0.00'),
                        premium_enabled=premium_enabled,
                        premium_price=standard_price * Decimal('1.60') if premium_enabled else Decimal('0.00'),
                        freight_enabled=freight_enabled,
                        freight_price=standard_price * Decimal('2.00') if freight_enabled else Decimal('0.00'),
                        admin_notes=f'{TEST_MARKER} bulk generated scheduled ride',
                    )
                    make_stops(ride, *route)
                    buses = create_bus_assignments(ride, profile, campus)
                    created.append({
                        'id': str(ride.id),
                        'reference': ride.reference,
                        'allowed_vehicle_types': ride.allowed_vehicle_types,
                        'buses': len(buses),
                        'departure_date': ride.departure_date.isoformat(),
                    })
        except Exception as exc:
            errors.append({'message': f'Batch failed at index {batch_start}: {str(exc)}'})
    return created, errors


def ensure_ondemand_rides(count, campus):
    created = []
    errors = []
    students = list(test_students_qs(campus).order_by('?')[:count])
    
    if len(students) < count:
        extra, _ = ensure_students(count - len(students), campus)
        students = list(test_students_qs(campus).order_by('?')[:count])
    
    rides_to_create = []
    for index, student in enumerate(students[:count]):
        route = random.choice(ROUTES)
        vehicle_type = random.choice([VehicleType.SEDAN, VehicleType.MPV, VehicleType.MINIBUS])
        distance = Decimal(str(random.uniform(2.0, 15.0)))
        duration = int(distance * 3) # Roughly 3 mins per km
        total_fare = distance * Decimal('150.00')
        
        reference = generate_reference('RD')
        ride = Ride(
            reference=reference,
            student=student,
            status=RideStatus.SEARCHING,
            vehicle_type_requested=vehicle_type,
            requested_seats=random.randint(1, 4),
            pickup_latitude=route[1],
            pickup_longitude=route[2],
            pickup_address=route[0],
            dropoff_latitude=route[4],
            dropoff_longitude=route[5],
            dropoff_address=route[3],
            estimated_distance_km=distance,
            estimated_duration_minutes=duration,
            base_fare=total_fare * Decimal('0.8'),
            total_fare=total_fare,
            payment_method=PaymentMethod.WALLET,
            cancellation_reason=f'{TEST_MARKER} generated on-demand ride',
        )
        rides_to_create.append(ride)
        
    try:
        created_rides = Ride.objects.bulk_create(rides_to_create)
        for ride in created_rides:
            created.append({
                'id': str(ride.id) if ride.id else '',
                'reference': ride.reference,
                'student': str(ride.student_id),
                'status': ride.status,
                'total_fare': str(ride.total_fare),
            })
    except Exception as exc:
        errors.append({'message': f'Bulk create failed: {str(exc)}'})
        
    return created, errors


def delete_users(queryset, count, current_user=None):
    users = list(queryset.exclude(id=getattr(current_user, 'id', None)).order_by('?')[:count])
    deleted = 0
    errors = []
    for user in users:
        try:
            with transaction.atomic():
                if user.role == UserRole.STUDENT:
                    ScheduledRidePassenger.objects.filter(student=user).delete()
                elif user.role == UserRole.DRIVER:
                    ScheduledRide.objects.filter(assigned_driver=user).update(assigned_driver=None)
                    ScheduledRideBusAssignment.objects.filter(driver=user).update(driver=None)
                WalletTransaction.objects.filter(user=user).delete()
                user.delete()
                deleted += 1
        except Exception as exc:
            errors.append({'id': str(user.id), 'message': str(exc)})
    return deleted, errors


def build_bus_capacity_state(ride):
    buses = ScheduledRideBusAssignment.objects.filter(ride=ride).exclude(
        status__in=['departed', 'en_route', 'arrived', 'completed'],
    ).order_by('order')
    return [
        {
            'bus': bus,
            'seats': bus.seats_available,
            'standing': bus.standing_available,
        }
        for bus in buses
    ]


def pick_bus_for_tier(tier, bus_state):
    for state in bus_state:
        if tier == PricingTier.STANDING and state['standing'] > 0:
            state['standing'] -= 1
            return state['bus'], SeatType.STANDING
        if tier != PricingTier.STANDING and state['seats'] > 0:
            state['seats'] -= 1
            return state['bus'], SeatType.SEATED
    return None


def serialize_summary(user):
    campus = get_request_campus(user)
    rides = (
        test_rides_qs(user)
        .select_related('assigned_driver')
        .order_by('departure_date', 'window_start')
    )
    
    ondemand_rides = test_ondemand_rides_qs().order_by('-requested_at')

    return {
        'enabled': test_tools_enabled(),
        'campus': campus.name if campus else None,
        'counts': {
            'students': test_students_qs(campus).count() if campus else 0,
            'drivers': test_drivers_qs(campus).count() if campus else 0,
            'admins': test_admins_qs(campus).count() if campus else 0,
            'scheduled_rides': test_rides_qs(user).count(),
            'ondemand_rides': ondemand_rides.count(),
        },
        'rides': [
            {
                'id': str(ride.id),
                'reference': ride.reference,
                'route': f'{ride.origin_address} -> {ride.destination_address}',
                'departure_date': ride.departure_date.isoformat(),
                'window': f'{ride.window_start.strftime("%H:%M")} - {ride.window_end.strftime("%H:%M")}',
                'status': ride.status,
                'allowed_vehicle_types': ride.allowed_vehicle_types,
                'passenger_count': ride.passenger_count,
                'driver': ride.assigned_driver.full_name if ride.assigned_driver else None,
            }
            for ride in rides
        ],
        'ondemand_rides': [
            {
                'id': str(ride.id),
                'reference': ride.reference,
                'route': f'{ride.pickup_address} -> {ride.dropoff_address}',
                'status': ride.status,
                'vehicle_type': ride.vehicle_type_requested,
                'passenger_count': ride.requested_seats,
                'student': ride.student.full_name,
            }
            for ride in ondemand_rides[:20] # Limit to latest 20 for payload size
        ],
    }


class TestToolBase(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def guard(self, request):
        disabled = require_test_tools()
        if disabled:
            return disabled
        campus = get_request_campus(request.user)
        if not campus:
            return Response(
                {'detail': 'No campus is available for this test operation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return campus

    def count_or_error(self, request):
        count, error = parse_count(request.data)
        if error:
            return None, Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        return count, None


class TestToolSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrCampusAdmin]

    def get(self, request):
        return Response(serialize_summary(request.user))


class TestToolCreateStudentsView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        created, errors = ensure_students(count, campus)
        return Response({'created': len(created), 'records': created, 'errors': errors})


class TestToolDeleteStudentsView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        deleted, errors = delete_users(test_students_qs(campus), count, request.user)
        return Response({'deleted': deleted, 'errors': errors})


class TestToolCreateDriversView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        created, errors = ensure_drivers(count, campus, request.user)
        return Response({'created': len(created), 'records': created, 'errors': errors})


class TestToolDeleteDriversView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        deleted, errors = delete_users(test_drivers_qs(campus), count, request.user)
        return Response({'deleted': deleted, 'errors': errors})


class TestToolCreateAdminsView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        created, errors = ensure_admins(count, campus)
        return Response({'created': len(created), 'records': created, 'errors': errors})


class TestToolDeleteAdminsView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        deleted, errors = delete_users(test_admins_qs(campus), count, request.user)
        return Response({'deleted': deleted, 'errors': errors})


class TestToolCreateRidesView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        created, errors = ensure_rides(count, campus, request.user)
        return Response({'created': len(created), 'records': created, 'errors': errors})


class TestToolDeleteRidesView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        rides = list(test_rides_qs(request.user).order_by('?')[:count])
        deleted = 0
        errors = []
        for ride in rides:
            try:
                with transaction.atomic():
                    ScheduledRidePassenger.objects.filter(ride=ride).delete()
                    ride.delete()
                    deleted += 1
            except Exception as exc:
                errors.append({'id': str(ride.id), 'reference': ride.reference, 'message': str(exc)})
        return Response({'deleted': deleted, 'errors': errors})


class TestToolCreateOnDemandRidesView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        created, errors = ensure_ondemand_rides(count, campus)
        return Response({'created': len(created), 'records': created, 'errors': errors})


class TestToolDeleteOnDemandRidesView(TestToolBase):
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        rides = list(test_ondemand_rides_qs().order_by('?')[:count])
        deleted = 0
        errors = []
        for ride in rides:
            try:
                ride.delete()
                deleted += 1
            except Exception as exc:
                errors.append({'id': str(ride.id), 'reference': ride.reference, 'message': str(exc)})
        return Response({'deleted': deleted, 'errors': errors})


class TestToolJoinRideView(TestToolBase):
    @transaction.atomic
    def post(self, request):
        campus = self.guard(request)
        if isinstance(campus, Response):
            return campus
        count, error = self.count_or_error(request)
        if error:
            return error
        ride_id = request.data.get('ride_id')
        if not ride_id:
            return Response({'detail': 'ride_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ride = test_rides_qs(request.user).select_for_update().get(id=ride_id)
        except ScheduledRide.DoesNotExist:
            return Response({'detail': 'Test scheduled ride not found.'}, status=status.HTTP_404_NOT_FOUND)
        if ride.status != ScheduledRideStatus.SCHEDULED or timezone.now() >= ride.join_deadline:
            return Response({'detail': 'This ride is not currently joinable.'}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = ScheduledRidePassenger.objects.filter(ride=ride).values_list('student_id', flat=True)
        students = list(test_students_qs(campus).exclude(id__in=existing_ids).order_by('?')[:count])
        auto_created = 0
        if len(students) < count:
            extra, extra_errors = ensure_students(count - len(students), campus)
            if extra_errors:
                return Response(
                    {
                        'detail': 'Could not create enough test students for the join action.',
                        'errors': extra_errors,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            auto_created = len(extra)
            students = list(test_students_qs(campus).exclude(id__in=existing_ids).order_by('?')[:count])

        stops = list(ride.stops.order_by('order'))
        bus_state = build_bus_capacity_state(ride)
        enabled_tiers = list(ride.enabled_tiers)
        joined = []
        errors = []
        for index, student in enumerate(students[:count]):
            tier = random.choice(enabled_tiers)
            price = Decimal(str(ride.get_tier_price(tier)))
            cargo_description = ''
            cargo_weight = None
            if tier == PricingTier.FREIGHT:
                cargo_description = random.choice(['Small luggage', 'Books package', 'Lab equipment box'])
                cargo_weight = Decimal(str(random.randint(1, max(1, min(ride.cargo_capacity_kg, 25)))))
            try:
                profile = student.student_profile
                if profile.wallet_balance < price:
                    profile.wallet_balance = price + Decimal('100000.00')
                balance_before = profile.wallet_balance
                profile.wallet_balance -= price
                profile.save(update_fields=['wallet_balance'])
                payment_reference = generate_reference('DR')
                WalletTransaction.objects.create(
                    reference=payment_reference,
                    user=student,
                    transaction_type=WalletTransaction.TransactionType.DEBIT,
                    source=WalletTransaction.Source.RIDE_PAYMENT,
                    amount=price,
                    balance_before=balance_before,
                    balance_after=profile.wallet_balance,
                    narration=f'Scheduled ride ticket - {ride.reference}',
                    metadata={
                        'scheduled_ride_id': str(ride.id),
                        'scheduled_ride_reference': ride.reference,
                        'pricing_tier': tier,
                        'test_tool': True,
                    },
                )
                assignment = pick_bus_for_tier(tier, bus_state)
                bus = assignment[0] if assignment else None
                seat_type = assignment[1] if assignment else SeatType.SEATED
                passenger = ScheduledRidePassenger.objects.create(
                    ride=ride,
                    student=student,
                    pricing_tier=tier,
                    bus_assignment=bus,
                    seat_type=seat_type,
                    boarding_stop=stops[0] if stops else None,
                    alighting_stop=stops[-1] if stops else None,
                    amount_paid=price,
                    payment_reference=payment_reference,
                    cargo_description=cargo_description,
                    cargo_weight_kg=cargo_weight,
                    status=PassengerStatus.CONFIRMED,
                )
                joined.append({
                    'student_id': str(student.id),
                    'passenger_id': str(passenger.id),
                    'pricing_tier': tier,
                    'bus': bus.bus_label if bus else None,
                })
            except Exception as exc:
                errors.append({'index': index + 1, 'student_id': str(student.id), 'message': str(exc)})
        return Response({'joined': len(joined), 'auto_created_students': auto_created, 'records': joined, 'errors': errors})
