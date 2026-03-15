import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
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