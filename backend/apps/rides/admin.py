from django.contrib import admin
from .models import Ride, DriverRideRequest


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