"""
WebSocket consumer for real-time ride data streaming to campus admin dashboard.

Campus admin connects → joins 'campus_admin_rides' group → receives live updates
whenever a garage ride is created, updated, departed, or cancelled,
or whenever an on-demand passenger ride is created, updated, or cancelled.
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger('apps.rides')

CAMPUS_ADMIN_GROUP = 'campus_admin_rides'


class CampusAdminRidesConsumer(AsyncWebsocketConsumer):
    """
    WebSocket endpoint: ws/campus-admin/rides/?token=<JWT>

    On connect:
      - Validates user is admin or campus_admin
      - Joins the campus_admin_rides channel group
      - Sends all currently active garage rides as 'initial_rides'
      - Sends all active on-demand passenger rides as 'initial_on_demand_rides'

    On receive (from group broadcast):
      Garage rides:
        - ride_created   → new ride card appears in the dashboard
        - ride_updated   → seat count / status changes in-place
        - ride_departed  → ride moves to departed state
        - ride_cancelled → ride removed from active list

      On-demand passenger rides:
        - on_demand_ride_created   → new passenger request card appears
        - on_demand_ride_updated   → status changes in-place
        - on_demand_ride_cancelled → removed from active list
    """

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # Only admin and campus_admin roles allowed
        role = getattr(self.user, 'role', None)
        if role not in ('admin', 'campus_admin'):
            await self.close(code=4003)
            return

        self.group_name = CAMPUS_ADMIN_GROUP
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('ws_campus_admin_connected user_id=%s role=%s', str(self.user.id), role)

        # Send initial payload: all active garage rides
        active_rides = await self.get_active_garage_rides()
        await self.send(text_data=json.dumps({
            'type': 'initial_rides',
            'rides': active_rides,
        }))

        # Send initial payload: all active on-demand passenger rides
        on_demand_rides = await self.get_active_on_demand_rides()
        await self.send(text_data=json.dumps({
            'type': 'initial_on_demand_rides',
            'rides': on_demand_rides,
        }))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        """Handle messages from the client (e.g., ping/refresh requests)."""
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = data.get('type')

        if msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
        elif msg_type == 'refresh':
            # Client requests a full refresh of active rides
            active_rides = await self.get_active_garage_rides()
            await self.send(text_data=json.dumps({
                'type': 'initial_rides',
                'rides': active_rides,
            }))
            on_demand_rides = await self.get_active_on_demand_rides()
            await self.send(text_data=json.dumps({
                'type': 'initial_on_demand_rides',
                'rides': on_demand_rides,
            }))

    # ── Group message handlers (called by channel_layer.group_send) ──────

    async def ride_created(self, event):
        """A new garage ride was just created by a driver."""
        await self.send(text_data=json.dumps({
            'type': 'ride_created',
            'ride': event['ride'],
        }))

    async def ride_updated(self, event):
        """A garage ride was updated (passenger boarded, seats changed, etc)."""
        await self.send(text_data=json.dumps({
            'type': 'ride_updated',
            'ride': event['ride'],
        }))

    async def ride_departed(self, event):
        """A garage ride has departed."""
        await self.send(text_data=json.dumps({
            'type': 'ride_departed',
            'ride': event['ride'],
        }))

    async def ride_cancelled(self, event):
        """A garage ride was cancelled."""
        await self.send(text_data=json.dumps({
            'type': 'ride_cancelled',
            'ride_id': event['ride_id'],
        }))

    async def on_demand_ride_created(self, event):
        """A new on-demand passenger ride request was created."""
        await self.send(text_data=json.dumps({
            'type': 'on_demand_ride_created',
            'ride': event['ride'],
        }))

    async def on_demand_ride_updated(self, event):
        """An on-demand ride status changed (e.g., driver assigned)."""
        await self.send(text_data=json.dumps({
            'type': 'on_demand_ride_updated',
            'ride': event['ride'],
        }))

    async def on_demand_ride_cancelled(self, event):
        """An on-demand passenger ride was cancelled."""
        await self.send(text_data=json.dumps({
            'type': 'on_demand_ride_cancelled',
            'ride_id': event['ride_id'],
        }))

    # ── Database helpers ─────────────────────────────────────────────────

    @database_sync_to_async
    def get_active_garage_rides(self):
        """Fetch all active (open/full) garage rides with driver info."""
        from .garage_models import GarageRide, GarageRideStatus
        from .garage_serializers import GarageRideDetailSerializer

        rides = GarageRide.objects.filter(
            status__in=[GarageRideStatus.OPEN, GarageRideStatus.FULL]
        ).select_related(
            'driver', 'driver__driver_profile'
        ).prefetch_related('passengers').order_by('-created_at')

        # Serialize without request context (no absolute URLs needed for WS)
        return GarageRideDetailSerializer(rides, many=True).data

    @database_sync_to_async
    def get_active_on_demand_rides(self):
        """Fetch all active on-demand passenger rides (searching/requested)."""
        from .models import Ride, RideStatus
        from .serializers import RideDetailSerializer

        rides = Ride.objects.filter(
            status__in=[RideStatus.REQUESTED, RideStatus.SEARCHING]
        ).select_related(
            'student', 'driver', 'driver__driver_profile'
        ).order_by('-requested_at')

        return RideDetailSerializer(rides, many=True).data
