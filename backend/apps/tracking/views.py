from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DriverLocation, DispatchIncidentLog
from apps.accounts.models import DriverProfile
from apps.rides.models import Ride


def _incident_cache_key(scope: str) -> str:
	return f'dispatch_incidents:{scope}'


class FleetPositionsView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		role = getattr(request.user, 'role', None)
		if role not in ('admin', 'campus_admin'):
			return Response({'detail': 'Access denied.'}, status=403)

		campus_id = None
		if role == 'campus_admin':
			try:
				campus_id = str(request.user.campus_admin_profile.campus_id)
			except Exception:
				return Response({'detail': 'Access denied.'}, status=403)

		max_age = getattr(settings, 'DISPATCH_FLEET_MAX_AGE_SECONDS', 120)
		cutoff = timezone.now() - timedelta(seconds=max_age)
		qs = DriverLocation.objects.filter(
			updated_at__gte=cutoff,
			driver__is_active=True,
			driver__driver_profile__is_online=True,
			driver__driver_profile__verification_status=DriverProfile.VerificationStatus.APPROVED,
		).select_related('driver', 'driver__driver_profile')

		if campus_id:
			qs = qs.filter(driver__driver_profile__campus_id=campus_id)

		data = []
		for loc in qs:
			profile = loc.driver.driver_profile
			data.append({
				'driver_id': str(loc.driver_id),
				'driver_name': loc.driver.full_name,
				'latitude': float(loc.latitude),
				'longitude': float(loc.longitude),
				'heading': loc.heading,
				'speed_kmh': loc.speed_kmh,
				'updated_at': loc.updated_at.isoformat(),
				'is_online': profile.is_online,
				'is_on_trip': profile.is_on_trip,
				'vehicle_type': profile.vehicle_type,
				'maintenance_status': profile.maintenance_status,
				'verification_status': profile.verification_status,
				'campus_id': str(profile.campus_id) if profile.campus_id else None,
			})

		return Response({'drivers': data})


class FleetIncidentsView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		role = getattr(request.user, 'role', None)
		if role not in ('admin', 'campus_admin'):
			return Response({'detail': 'Access denied.'}, status=403)

		campus_id = None
		if role == 'campus_admin':
			try:
				campus_id = str(request.user.campus_admin_profile.campus_id)
			except Exception:
				return Response({'detail': 'Access denied.'}, status=403)

		cache_key = _incident_cache_key(campus_id or 'all')
		incidents = cache.get(cache_key, [])
		return Response({'incidents': incidents})


class DispatchIncidentHistoryView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		role = getattr(request.user, 'role', None)
		if role not in ('admin', 'campus_admin'):
			return Response({'detail': 'Access denied.'}, status=403)

		campus_id = None
		if role == 'campus_admin':
			try:
				campus_id = str(request.user.campus_admin_profile.campus_id)
			except Exception:
				return Response({'detail': 'Access denied.'}, status=403)

		limit = int(request.query_params.get('limit', 50))
		limit = max(1, min(limit, 200))

		qs = DispatchIncidentLog.objects.all().order_by('-last_seen_at')
		if campus_id:
			qs = qs.filter(campus_id=campus_id)

		data = []
		for incident in qs[:limit]:
			data.append({
				'id': incident.incident_key,
				'type': incident.incident_type,
				'severity': incident.severity,
				'ride_id': str(incident.ride_id) if incident.ride_id else None,
				'driver_id': str(incident.driver_id) if incident.driver_id else None,
				'message': incident.message,
				'latitude': float(incident.latitude) if incident.latitude is not None else None,
				'longitude': float(incident.longitude) if incident.longitude is not None else None,
				'first_seen_at': incident.first_seen_at.isoformat(),
				'last_seen_at': incident.last_seen_at.isoformat(),
			})

		return Response({'incidents': data})


class DispatchKpiView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		role = getattr(request.user, 'role', None)
		if role not in ('admin', 'campus_admin'):
			return Response({'detail': 'Access denied.'}, status=403)

		campus_id = None
		if role == 'campus_admin':
			try:
				campus_id = str(request.user.campus_admin_profile.campus_id)
			except Exception:
				return Response({'detail': 'Access denied.'}, status=403)

		window_minutes = getattr(settings, 'DISPATCH_KPI_WINDOW_MINUTES', 60)
		sla_target = getattr(settings, 'DISPATCH_SLA_TARGET_MINUTES', 8)
		cutoff = timezone.now() - timedelta(minutes=window_minutes)

		qs = Ride.objects.filter(requested_at__gte=cutoff)
		if campus_id:
			qs = qs.filter(student__student_profile__campus_id=campus_id)

		assigned = qs.filter(driver_assigned_at__isnull=False)
		durations = []
		for ride in assigned.only('requested_at', 'driver_assigned_at'):
			if ride.driver_assigned_at:
				delta = (ride.driver_assigned_at - ride.requested_at).total_seconds() / 60
				durations.append(delta)

		breaches = len([d for d in durations if d > sla_target])
		avg_dispatch = round(sum(durations) / len(durations), 2) if durations else None
		breach_pct = round((breaches / len(durations)) * 100, 1) if durations else 0.0

		return Response({
			'window_minutes': window_minutes,
			'sla_target_minutes': sla_target,
			'total_requests': qs.count(),
			'total_assigned': len(durations),
			'sla_breach_pct': breach_pct,
			'avg_dispatch_minutes': avg_dispatch,
		})
