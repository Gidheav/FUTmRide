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
        self.graph_version = RouteGraphVersion.get_active()
        self.nodes = {}  # index -> (lat, lng)
        self.node_to_idx = {}  # (lat, lng) -> index
        self.edges = {}  # u -> list of (v, weight_km, lane_id)
        self.lanes_cache = {}
        self._build_graph()

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
                
                self.edges[u].append((v, dist, str(lane.id)))
                if lane.direction == RouteLane.Direction.TWO_WAY:
                    self.edges[v].append((u, dist, str(lane.id)))

    def _find_nearest_node(self, lat: float, lng: float) -> int | None:
        if not self.nodes:
            return None
            
        best_node = None
        min_dist = float('inf')
        
        # O(N) search is fine for < 10,000 nodes
        for idx, (n_lat, n_lng) in self.nodes.items():
            dist = _haversine_distance(lat, lng, n_lat, n_lng)
            if dist < min_dist:
                min_dist = dist
                best_node = idx
                
        return best_node

    def resolve(self, pickup_lat: float, pickup_lng: float, dropoff_lat: float, dropoff_lng: float) -> Dict[str, Any] | None:
        if not self.graph_version or not self.nodes:
            return None
            
        start_node = self._find_nearest_node(pickup_lat, pickup_lng)
        end_node = self._find_nearest_node(dropoff_lat, dropoff_lng)
        
        if start_node is None or end_node is None:
            return None

        # Snap distances
        snap_pickup = _haversine_distance(pickup_lat, pickup_lng, *self.nodes[start_node])
        snap_dropoff = _haversine_distance(dropoff_lat, dropoff_lng, *self.nodes[end_node])
        
        # If the nearest points on the campus graph are too far (>1km), fallback to OSRM/Google
        if snap_pickup > 1.0 or snap_dropoff > 1.0:
            logger.warning(f"CampusRouter: Points too far from graph. Pickup snap: {snap_pickup:.2f}km, Dropoff snap: {snap_dropoff:.2f}km")
            return None

        # Dijkstra
        distances = {node: float('inf') for node in self.nodes}
        distances[start_node] = 0
        previous = {node: None for node in self.nodes}
        
        pq = [(0, start_node)]
        
        while pq:
            current_dist, u = heapq.heappop(pq)
            
            if u == end_node:
                break
                
            if current_dist > distances[u]:
                continue
                
            for v, weight, lane_id in self.edges.get(u, []):
                distance = current_dist + weight
                
                if distance < distances[v]:
                    distances[v] = distance
                    previous[v] = (u, lane_id)
                    heapq.heappush(pq, (distance, v))

        if distances[end_node] == float('inf'):
            return None

        # Reconstruct path
        path_nodes = []
        path_lanes = set()
        curr = end_node
        
        while curr is not None:
            path_nodes.append(curr)
            prev_info = previous[curr]
            if prev_info:
                curr, lane_id = prev_info
                path_lanes.add(lane_id)
            else:
                curr = None
                
        path_nodes.reverse()
        
        geometry = []
        for idx in path_nodes:
            lat, lng = self.nodes[idx]
            geometry.append({'latitude': lat, 'longitude': lng})
            
        total_distance = distances[end_node] + snap_pickup + snap_dropoff

        return {
            'distance_km': round(total_distance, 3),
            'geometry': geometry,
            'provider': 'calibrated_graph',
            'confidence': 'high' if snap_pickup < 0.1 and snap_dropoff < 0.1 else 'medium',
            'metadata': {
                'graph_version': str(self.graph_version.id),
                'lanes_used': list(path_lanes),
                'snap_pickup_km': round(snap_pickup, 3),
                'snap_dropoff_km': round(snap_dropoff, 3),
            }
        }
