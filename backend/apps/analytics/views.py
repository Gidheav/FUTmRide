import logging
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, DriverProfile
from apps.accounts.permissions import IsAdminUser
from apps.rides.models import Ride, RideStatus
from apps.payments.models import WalletTransaction

logger = logging.getLogger('apps.analytics')


class PlatformSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)

        total_users = User.objects.filter(is_active=True).count()
        total_students = User.objects.filter(role='student', is_active=True).count()
        total_drivers = User.objects.filter(role='driver', is_active=True).count()
        drivers_online = DriverProfile.objects.filter(is_online=True).count()
        drivers_approved = DriverProfile.objects.filter(
            verification_status=DriverProfile.VerificationStatus.APPROVED
        ).count()
        drivers_pending = DriverProfile.objects.filter(
            verification_status=DriverProfile.VerificationStatus.PENDING
        ).count()

        total_rides = Ride.objects.count()
        completed_rides = Ride.objects.filter(status=RideStatus.COMPLETED).count()
        active_rides = Ride.objects.filter(
            status__in=[
                RideStatus.SEARCHING, RideStatus.DRIVER_ASSIGNED,
                RideStatus.DRIVER_EN_ROUTE, RideStatus.DRIVER_ARRIVED,
                RideStatus.IN_PROGRESS,
            ]
        ).count()
        rides_today = Ride.objects.filter(requested_at__gte=today_start).count()
        rides_this_week = Ride.objects.filter(requested_at__gte=week_start).count()
        rides_this_month = Ride.objects.filter(requested_at__gte=month_start).count()

        revenue = WalletTransaction.objects.filter(
            source=WalletTransaction.Source.PLATFORM_COMMISSION
        ).aggregate(total=Sum('amount'))['total'] or 0

        revenue_today = WalletTransaction.objects.filter(
            source=WalletTransaction.Source.PLATFORM_COMMISSION,
            created_at__gte=today_start,
        ).aggregate(total=Sum('amount'))['total'] or 0

        avg_fare = Ride.objects.filter(
            status=RideStatus.COMPLETED,
            total_fare__isnull=False,
        ).aggregate(avg=Avg('total_fare'))['avg'] or 0

        return Response({
            'users': {
                'total': total_users,
                'students': total_students,
                'drivers': total_drivers,
                'drivers_online': drivers_online,
                'drivers_approved': drivers_approved,
                'drivers_pending_review': drivers_pending,
            },
            'rides': {
                'total': total_rides,
                'completed': completed_rides,
                'active_now': active_rides,
                'today': rides_today,
                'this_week': rides_this_week,
                'this_month': rides_this_month,
                'completion_rate': round((completed_rides / total_rides * 100), 2) if total_rides else 0,
                'average_fare': round(float(avg_fare), 2),
            },
            'revenue': {
                'total_commission': round(float(revenue), 2),
                'today': round(float(revenue_today), 2),
            },
        })


class RideTrendView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        days = int(request.query_params.get('days', 7))
        days = min(days, 90)
        now = timezone.now()
        result = []
        for i in range(days - 1, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = Ride.objects.filter(requested_at__gte=day_start, requested_at__lt=day_end).count()
            completed = Ride.objects.filter(
                requested_at__gte=day_start,
                requested_at__lt=day_end,
                status=RideStatus.COMPLETED,
            ).count()
            result.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'total': count,
                'completed': completed,
            })
        return Response({'trend': result, 'days': days})