from datetime import timedelta
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DriverLocation
from apps.accounts.models import DriverProfile


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
