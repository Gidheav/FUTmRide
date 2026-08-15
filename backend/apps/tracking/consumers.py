import json
import logging
from datetime import timedelta
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('apps.tracking')


class DriverLocationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'driver_{self.user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('ws_driver_connected user_id=%s', str(self.user.id))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = data.get('type')

        if msg_type == 'location_update':
            lat = data.get('latitude')
            lng = data.get('longitude')
            heading = data.get('heading')
            speed = data.get('speed_kmh')
            accuracy = data.get('accuracy_meters')

            if lat is None or lng is None:
                return

            await self.save_location(lat, lng, heading, speed, accuracy)

            await self.broadcast_fleet_location(lat, lng, heading, speed)

            ride_id = await self.get_active_ride_id()
            if ride_id:
                await self.channel_layer.group_send(
                    f'ride_{ride_id}',
                    {
                        'type': 'driver_location',
                        'latitude': lat,
                        'longitude': lng,
                        'heading': heading,
                        'speed_kmh': speed,
                        'driver_id': str(self.user.id),
                    },
                )

        elif msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    @database_sync_to_async
    def save_location(self, lat, lng, heading, speed, accuracy):
        from .models import DriverLocation
        DriverLocation.objects.update_or_create(
            driver=self.user,
            defaults={
                'latitude': lat,
                'longitude': lng,
                'heading': heading,
                'speed_kmh': speed,
                'accuracy_meters': accuracy,
            },
        )

    async def broadcast_fleet_location(self, lat, lng, heading, speed):
        should_send = await self.should_broadcast_fleet()
        if not should_send:
            return

        payload = await self.build_fleet_payload(lat, lng, heading, speed)
        if not payload:
            return

        campus_group = payload.get('campus_group')
        payload.pop('campus_group', None)

        if campus_group:
            await self.channel_layer.group_send(campus_group, {
                'type': 'fleet_location',
                'data': payload,
            })

        await self.channel_layer.group_send('campus_admin_fleet_all', {
            'type': 'fleet_location',
            'data': payload,
        })

    @database_sync_to_async
    def should_broadcast_fleet(self):
        interval = getattr(settings, 'DISPATCH_FLEET_BROADCAST_INTERVAL_SECONDS', 2)
        cache_key = f'fleet_last_broadcast:{self.user.id}'
        now = timezone.now().timestamp()
        last = cache.get(cache_key)
        if last and (now - float(last)) < interval:
            return False
        cache.set(cache_key, now, timeout=interval * 2)
        return True

    @database_sync_to_async
    def build_fleet_payload(self, lat, lng, heading, speed):
        try:
            profile = self.user.driver_profile
        except Exception:
            return None

        campus_id = str(profile.campus_id) if profile.campus_id else None
        return {
            'driver_id': str(self.user.id),
            'driver_name': self.user.full_name,
            'latitude': float(lat),
            'longitude': float(lng),
            'heading': heading,
            'speed_kmh': speed,
            'updated_at': timezone.now().isoformat(),
            'is_online': profile.is_online,
            'is_on_trip': profile.is_on_trip,
            'vehicle_type': profile.vehicle_type,
            'maintenance_status': profile.maintenance_status,
            'verification_status': profile.verification_status,
            'campus_id': campus_id,
            'campus_group': f'campus_admin_fleet_{campus_id}' if campus_id else None,
        }

    @database_sync_to_async
    def get_active_ride_id(self):
        from apps.rides.models import Ride, RideStatus
        ride = Ride.objects.filter(
            driver=self.user,
            status__in=[
                RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_EN_ROUTE,
                RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS,
            ],
        ).values_list('id', flat=True).first()
        return str(ride) if ride else None

    async def driver_location(self, event):
        await self.send(text_data=json.dumps(event))


class RideTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        allowed = await self.is_ride_participant()
        if not allowed:
            await self.close(code=4003)
            return

        self.group_name = f'ride_{self.ride_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('ws_ride_tracking_connected ride=%s user=%s', self.ride_id, str(self.user.id))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return
        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    @database_sync_to_async
    def is_ride_participant(self):
        from apps.rides.models import Ride
        try:
            ride = Ride.objects.get(id=self.ride_id)
            return ride.student == self.user or ride.driver == self.user or self.user.role == 'admin'
        except Ride.DoesNotExist:
            return False

    async def driver_location(self, event):
        await self.send(text_data=json.dumps(event))

    async def ride_status_update(self, event):
        await self.send(text_data=json.dumps(event))


class CampusAdminFleetConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        role = getattr(self.user, 'role', None)
        if role not in ('admin', 'campus_admin'):
            await self.close(code=4003)
            return

        self.campus_id = await self.get_campus_id()
        if role == 'campus_admin' and not self.campus_id:
            await self.close(code=4003)
            return

        self.group_name = f'campus_admin_fleet_{self.campus_id}' if self.campus_id else 'campus_admin_fleet_all'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('ws_campus_admin_fleet_connected user_id=%s campus=%s', str(self.user.id), self.campus_id)

        initial = await self.get_fleet_snapshot(self.campus_id)
        map_config = await self.get_map_layer_config()
        await self.send(text_data=json.dumps({
            'type': 'initial_positions',
            'drivers': initial,
            'map_config': map_config,
        }))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
        elif data.get('type') == 'refresh':
            initial = await self.get_fleet_snapshot(self.campus_id)
            map_config = await self.get_map_layer_config()
            await self.send(text_data=json.dumps({
                'type': 'initial_positions',
                'drivers': initial,
                'map_config': map_config,
            }))

    async def fleet_location(self, event):
        await self.send(text_data=json.dumps({
            'type': 'driver_location',
            'driver': event.get('data', {}),
        }))

    @database_sync_to_async
    def get_campus_id(self):
        try:
            profile = self.user.campus_admin_profile
        except Exception:
            return None
        return str(profile.campus_id) if profile.campus_id else None

    @database_sync_to_async
    def get_fleet_snapshot(self, campus_id):
        from .models import DriverLocation
        from apps.accounts.models import DriverProfile

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

        return data

    @database_sync_to_async
    def get_map_layer_config(self):
        from apps.accounts.map_config import get_map_layer_config

        return get_map_layer_config()


class CampusAdminIncidentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        role = getattr(self.user, 'role', None)
        if role not in ('admin', 'campus_admin'):
            await self.close(code=4003)
            return

        self.campus_id = await self.get_campus_id()
        if role == 'campus_admin' and not self.campus_id:
            await self.close(code=4003)
            return

        self.group_name = f'campus_admin_incidents_{self.campus_id}' if self.campus_id else 'campus_admin_incidents_all'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('ws_campus_admin_incidents_connected user_id=%s campus=%s', str(self.user.id), self.campus_id)

        incidents = await self.get_incidents(self.campus_id)
        await self.send(text_data=json.dumps({
            'type': 'initial_incidents',
            'incidents': incidents,
        }))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
        elif data.get('type') == 'refresh':
            incidents = await self.get_incidents(self.campus_id)
            await self.send(text_data=json.dumps({
                'type': 'initial_incidents',
                'incidents': incidents,
            }))

    async def incident_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'incident_update',
            'incidents': event.get('incidents', []),
        }))

    @database_sync_to_async
    def get_campus_id(self):
        try:
            profile = self.user.campus_admin_profile
        except Exception:
            return None
        return str(profile.campus_id) if profile.campus_id else None

    @database_sync_to_async
    def get_incidents(self, campus_id):
        scope = campus_id or 'all'
        cache_key = f'dispatch_incidents:{scope}'
        return cache.get(cache_key, [])
