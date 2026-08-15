from django.core.cache import cache

from .models import MapSettings
from .serializers import normalize_map_pois


PUBLIC_MAP_SETTINGS_CACHE_KEY = 'public_map_settings'
PUBLIC_MAP_SETTINGS_TTL_SECONDS = 60


def get_map_layer_config(settings_obj=None):
    settings_obj = settings_obj or MapSettings.load()
    return {
        'live_traffic_enabled': settings_obj.live_traffic_enabled,
        'demand_heatmaps_enabled': settings_obj.demand_heatmaps_enabled,
        'driver_clustering_enabled': settings_obj.driver_clustering_enabled,
        'refresh_interval_seconds': settings_obj.refresh_interval_seconds,
        'cluster_threshold_zoom': settings_obj.cluster_threshold_zoom,
        'idle_driver_icon': settings_obj.idle_driver_icon,
        'config_version': settings_obj.config_version,
    }


def get_public_map_settings(settings_obj=None):
    settings_obj = settings_obj or MapSettings.load()
    return {
        'active_provider': settings_obj.active_provider,
        'default_map_type': settings_obj.default_map_type,
        'geofence_buffer_meters': settings_obj.geofence_buffer_meters,
        'pois': [
            poi for poi in normalize_map_pois(settings_obj.pois or [])
            if poi.get('status') == 'active'
        ],
        'active_route_graph': get_active_route_graph_summary(),
        'updated_at': settings_obj.updated_at,
        **get_map_layer_config(settings_obj),
    }


def get_cached_public_map_settings():
    cached = cache.get(PUBLIC_MAP_SETTINGS_CACHE_KEY)
    if cached:
        return cached
    data = get_public_map_settings()
    cache.set(PUBLIC_MAP_SETTINGS_CACHE_KEY, data, timeout=PUBLIC_MAP_SETTINGS_TTL_SECONDS)
    return data


def invalidate_public_map_settings():
    cache.delete(PUBLIC_MAP_SETTINGS_CACHE_KEY)


def get_active_route_graph_summary():
    try:
        from apps.pricing.models import RouteGraphVersion
        graph = RouteGraphVersion.get_active()
    except Exception:
        graph = None
    return {'configured': bool(graph), 'version_name': graph.version_name if graph else ''}
