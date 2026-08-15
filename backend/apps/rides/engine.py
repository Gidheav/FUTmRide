import math
import heapq
import logging
from typing import List, Dict, Tuple, Any

from apps.pricing.models import RouteGraphVersion, RouteLane

logger = logging.getLogger(__name__)

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points on the earth."""
    R = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class CampusRouter:
    """
    A lightweight, pure-Python router for the campus road network.
    It builds an adjacency list from the active RouteGraphVersion and uses Dijkstra's algorithm.
    """

    def __init__(self, vehicle_type: str = None):
        self.vehicle_type = vehicle_type
        self.map_settings = self._load_map_settings()
        self.graph_version = RouteGraphVersion.get_active()
        self.nodes = {}  # index -> (lat, lng)
        self.node_to_idx = {}  # (lat, lng) -> index
        self.edges = {}  # u -> list of (v, cost_km, lane_id, physical_km)
        self.lanes_cache = {}
        self._build_graph()

    def _load_map_settings(self):
        try:
            from apps.accounts.models import MapSettings
            return MapSettings.load()
        except Exception:
            return None

    def _lane_cost_multiplier(self, lane: RouteLane) -> float:
        if not self.map_settings:
            return 1.0
        main_weight = max(0, min(100, getattr(self.map_settings, 'prefer_main_roads_weight', 85))) / 100
        pedestrian_weight = max(0, min(100, getattr(self.map_settings, 'avoid_pedestrian_weight', 95))) / 100
        speed_weight = max(0, min(100, getattr(self.map_settings, 'speed_limit_enforcement_weight', 50))) / 100
        label = f'{lane.name or ""} {lane.priority or ""}'.lower()

        multiplier = 1.0
        if 'main' in label or lane.priority == 'main':
            multiplier -= 0.25 * main_weight
        if any(token in label for token in ('pedestrian', 'walkway', 'footpath')):
            multiplier += 2.0 * pedestrian_weight
        if any(token in label for token in ('slow', 'speed_limit', 'speed limit')):
            multiplier += 0.5 * speed_weight
        return max(0.25, multiplier)

    def _get_node_idx(self, lat: float, lng: float) -> int:
        coord = (round(float(lat), 6), round(float(lng), 6))
        if coord not in self.node_to_idx:
            idx = len(self.nodes)
            self.nodes[idx] = coord
            self.node_to_idx[coord] = idx
            self.edges[idx] = []
        return self.node_to_idx[coord]

    def _build_graph(self):
        if not self.graph_version:
            return

        lanes = self.graph_version.lanes.filter(status=RouteLane.Status.ACTIVE)
        for lane in lanes:
            # Check vehicle type allowance
            if self.vehicle_type and lane.allowed_vehicles:
                if self.vehicle_type not in lane.allowed_vehicles:
                    continue
            
            geom = lane.geometry or []
            if len(geom) < 2:
                continue

            self.lanes_cache[str(lane.id)] = lane

            for i in range(len(geom) - 1):
                p1, p2 = geom[i], geom[i+1]
                lat1, lng1 = p1.get('lat', p1.get('latitude')), p1.get('lng', p1.get('longitude'))
                lat2, lng2 = p2.get('lat', p2.get('latitude')), p2.get('lng', p2.get('longitude'))
                
                if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
                    continue

                u = self._get_node_idx(lat1, lng1)
                v = self._get_node_idx(lat2, lng2)
                
                # Approximate distance for this specific segment
                dist = _haversine_distance(lat1, lng1, lat2, lng2)
                
                cost = dist * self._lane_cost_multiplier(lane)
                self.edges[u].append((v, cost, str(lane.id), dist))
                if lane.direction == RouteLane.Direction.TWO_WAY:
                    self.edges[v].append((u, cost, str(lane.id), dist))

    def _project_to_segment(
        self,
        lat: float,
        lng: float,
        a_lat: float,
        a_lng: float,
        b_lat: float,
        b_lng: float,
    ) -> tuple[float, float, float]:
        origin_lat = math.radians(lat)
        meters_per_deg_lat = 111_320
        meters_per_deg_lng = 111_320 * math.cos(origin_lat)

        px = lng * meters_per_deg_lng
        py = lat * meters_per_deg_lat
        ax = a_lng * meters_per_deg_lng
        ay = a_lat * meters_per_deg_lat
        bx = b_lng * meters_per_deg_lng
        by = b_lat * meters_per_deg_lat
        dx = bx - ax
        dy = by - ay
        length_sq = dx * dx + dy * dy
        t = 0 if length_sq == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length_sq))
        projected_lat = a_lat + ((b_lat - a_lat) * t)
        projected_lng = a_lng + ((b_lng - a_lng) * t)
        snap_km = _haversine_distance(lat, lng, projected_lat, projected_lng)
        return projected_lat, projected_lng, snap_km

    def _find_nearest_segment(self, lat: float, lng: float) -> dict[str, Any] | None:
        if not self.graph_version:
            return None

        best = None
        lanes = self.graph_version.lanes.filter(status=RouteLane.Status.ACTIVE)
        for lane in lanes:
            if self.vehicle_type and lane.allowed_vehicles and self.vehicle_type not in lane.allowed_vehicles:
                continue

            geom = lane.geometry or []
            if len(geom) < 2:
                continue

            for i in range(len(geom) - 1):
                p1, p2 = geom[i], geom[i + 1]
                lat1, lng1 = p1.get('lat', p1.get('latitude')), p1.get('lng', p1.get('longitude'))
                lat2, lng2 = p2.get('lat', p2.get('latitude')), p2.get('lng', p2.get('longitude'))
                if lat1 is None or lng1 is None or lat2 is None or lng2 is None:
                    continue

                projected_lat, projected_lng, snap_km = self._project_to_segment(
                    lat,
                    lng,
                    float(lat1),
                    float(lng1),
                    float(lat2),
                    float(lng2),
                )
                if best is None or snap_km < best['snap_km']:
                    best = {
                        'lane': lane,
                        'from_node': self._get_node_idx(lat1, lng1),
                        'to_node': self._get_node_idx(lat2, lng2),
                        'from_coord': (float(lat1), float(lng1)),
                        'to_coord': (float(lat2), float(lng2)),
                        'projected_coord': (round(projected_lat, 6), round(projected_lng, 6)),
                        'snap_km': snap_km,
                    }
        return best

    def _connect_virtual_endpoint(self, edges, nodes, virtual_idx: int, segment: dict[str, Any], is_start: bool):
        lane = segment['lane']
        projected = segment['projected_coord']
        from_node = segment['from_node']
        to_node = segment['to_node']
        from_coord = segment['from_coord']
        to_coord = segment['to_coord']
        snap_km = segment['snap_km']
        to_from_km = _haversine_distance(projected[0], projected[1], from_coord[0], from_coord[1])
        to_to_km = _haversine_distance(projected[0], projected[1], to_coord[0], to_coord[1])
        lane_id = str(lane.id)
        edges.setdefault(virtual_idx, [])

        if is_start:
            edges[virtual_idx].append((to_node, snap_km + to_to_km, lane_id, snap_km + to_to_km))
            if lane.direction == RouteLane.Direction.TWO_WAY:
                edges[virtual_idx].append((from_node, snap_km + to_from_km, lane_id, snap_km + to_from_km))
        else:
            edges.setdefault(from_node, []).append((virtual_idx, to_from_km + snap_km, lane_id, to_from_km + snap_km))
            if lane.direction == RouteLane.Direction.TWO_WAY:
                edges.setdefault(to_node, []).append((virtual_idx, to_to_km + snap_km, lane_id, to_to_km + snap_km))

        nodes[virtual_idx] = projected

    def resolve(self, pickup_lat: float, pickup_lng: float, dropoff_lat: float, dropoff_lng: float) -> Dict[str, Any] | None:
        if not self.graph_version or not self.nodes:
            return None

        start_segment = self._find_nearest_segment(pickup_lat, pickup_lng)
        end_segment = self._find_nearest_segment(dropoff_lat, dropoff_lng)

        if start_segment is None or end_segment is None:
            return None

        snap_pickup = start_segment['snap_km']
        snap_dropoff = end_segment['snap_km']

        # If the nearest points on the campus graph are too far (>1km), fallback to OSRM/Google
        if snap_pickup > 1.0 or snap_dropoff > 1.0:
            logger.warning(f"CampusRouter: Points too far from graph. Pickup snap: {snap_pickup:.2f}km, Dropoff snap: {snap_dropoff:.2f}km")
            return None

        nodes = dict(self.nodes)
        edges = {node: list(values) for node, values in self.edges.items()}
        start_node = max(nodes.keys()) + 1
        end_node = start_node + 1
        self._connect_virtual_endpoint(edges, nodes, start_node, start_segment, is_start=True)
        self._connect_virtual_endpoint(edges, nodes, end_node, end_segment, is_start=False)

        # Dijkstra
        distances = {node: float('inf') for node in nodes}
        distances[start_node] = 0
        previous = {node: None for node in nodes}

        pq = [(0, start_node)]

        while pq:
            current_dist, u = heapq.heappop(pq)

            if u == end_node:
                break

            if current_dist > distances[u]:
                continue

            for v, weight, lane_id, physical_km in edges.get(u, []):
                distance = current_dist + weight

                if distance < distances[v]:
                    distances[v] = distance
                    previous[v] = (u, lane_id, physical_km)
                    heapq.heappush(pq, (distance, v))

        if distances[end_node] == float('inf'):
            return None

        # Reconstruct path
        path_nodes = []
        path_lanes = set()
        physical_segments = []
        curr = end_node
        
        while curr is not None:
            path_nodes.append(curr)
            prev_info = previous[curr]
            if prev_info:
                curr, lane_id, physical_km = prev_info
                path_lanes.add(lane_id)
                physical_segments.append(physical_km)
            else:
                curr = None
                
        path_nodes.reverse()
        
        geometry = []
        for idx in path_nodes:
            lat, lng = nodes[idx]
            geometry.append({'latitude': lat, 'longitude': lng})

        total_distance = sum(physical_segments)

        return {
            'distance_km': round(total_distance, 3),
            'geometry': geometry,
            'provider': 'calibrated_graph',
            'confidence': 'high' if snap_pickup < 0.1 and snap_dropoff < 0.1 else 'medium',
            'metadata': {
                'graph_version': str(self.graph_version.id),
                'lanes_used': list(path_lanes),
                'snap_method': 'nearest_lane_segment',
                'snap_pickup_km': round(snap_pickup, 3),
                'snap_dropoff_km': round(snap_dropoff, 3),
                'route_cost_km': round(distances[end_node], 3),
                'routing_weights': {
                    'prefer_main_roads': getattr(self.map_settings, 'prefer_main_roads_weight', None),
                    'avoid_pedestrian_walkways': getattr(self.map_settings, 'avoid_pedestrian_weight', None),
                    'speed_limit_enforcement': getattr(self.map_settings, 'speed_limit_enforcement_weight', None),
                },
            }
        }
