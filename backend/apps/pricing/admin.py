from django.contrib import admin
from .models import FareConfiguration


@admin.register(FareConfiguration)
class FareConfigurationAdmin(admin.ModelAdmin):
    list_display = ['vehicle_type', 'base_fare', 'per_km_rate', 'minimum_fare', 'is_active', 'effective_from']
    list_filter = ['vehicle_type', 'is_active']
    readonly_fields = ['id', 'created_at', 'updated_at']