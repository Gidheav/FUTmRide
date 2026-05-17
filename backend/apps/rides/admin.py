from django.contrib import admin
from .models import Ride, DriverRideRequest
from .garage_models import GarageRide, GarageRidePassenger


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = [
        'reference', 'student', 'driver', 'status',
        'vehicle_type_requested', 'total_fare', 'payment_method', 'is_paid', 'requested_at'
    ]
    list_filter = ['status', 'vehicle_type_requested', 'payment_method', 'is_paid']
    search_fields = ['reference', 'student__first_name', 'student__phone_number', 'driver__phone_number']
    readonly_fields = [
        'id', 'reference', 'requested_at', 'driver_assigned_at',
        'driver_arrived_at', 'trip_started_at', 'trip_completed_at', 'updated_at'
    ]
    ordering = ['-requested_at']


@admin.register(DriverRideRequest)
class DriverRideRequestAdmin(admin.ModelAdmin):
    list_display = ['ride', 'driver', 'response', 'offered_at', 'responded_at']
    list_filter = ['response']
    search_fields = ['ride__reference', 'driver__phone_number']
    readonly_fields = ['id', 'offered_at']


@admin.register(GarageRide)
class GarageRideAdmin(admin.ModelAdmin):
    list_display = [
        'reference', 'driver', 'origin_address', 'destination_address',
        'vehicle_type', 'fare_per_seat', 'total_seats', 'booked_seats',
        'status', 'created_at',
    ]
    list_filter = ['status', 'vehicle_type']
    search_fields = ['reference', 'driver__phone_number', 'origin_address', 'destination_address']
    readonly_fields = ['id', 'qr_token', 'reference', 'created_at', 'departed_at']
    ordering = ['-created_at']


@admin.register(GarageRidePassenger)
class GarageRidePassengerAdmin(admin.ModelAdmin):
    list_display = ['garage_ride', 'student', 'seats_booked', 'amount_paid', 'boarded_at']
    search_fields = ['garage_ride__reference', 'student__phone_number']
    readonly_fields = ['id', 'boarded_at']