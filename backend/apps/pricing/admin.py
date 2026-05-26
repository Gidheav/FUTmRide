from django.contrib import admin
from .models import FareConfiguration, PlatformSettings


@admin.register(FareConfiguration)
class FareConfigurationAdmin(admin.ModelAdmin):
    list_display = ['vehicle_type', 'base_fare', 'per_km_rate', 'minimum_fare', 'is_active', 'effective_from']
    list_filter = ['vehicle_type', 'is_active']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ['commission_rate', 'distance_provider', 'max_distance_km', 'no_show_fee_enabled', 'updated_at']
    readonly_fields = ['id', 'updated_at']

    def has_add_permission(self, request):
        # Singleton: disallow creating if one already exists
        return not PlatformSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False