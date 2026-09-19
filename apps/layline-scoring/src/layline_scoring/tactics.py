"""
Tactical Regatta Leg & Mark Rounding Engine (layline-scoring)
Calculates Haversine distance, true bearing, and mark rounding events
from real-time GPS fixes against virtual course marks.
"""
import math
from datetime import datetime
from typing import Dict, Any, List, Optional

EARTH_RADIUS_NM = 3440.065  # Nautical miles

def haversine_distance_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two decimal degree points in nautical miles."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_NM * c

def initial_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes initial bearing from point 1 to point 2 in degrees (000-359)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    x = math.sin(delta_lambda) * math.cos(phi2)
    y = (math.cos(phi1) * math.sin(phi2) -
         math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda))
    initial_bearing = math.atan2(x, y)
    compass = (math.degrees(initial_bearing) + 360.0) % 360.0
    return round(compass, 1)

def detect_rounding(
    point: Dict[str, Any], 
    mark: Dict[str, Any], 
    threshold_nm: float = 0.025  # ~150 feet / 46 meters zone
) -> Optional[Dict[str, Any]]:
    """
    Evaluates whether a navigation point falls within the mark rounding cylinder.
    """
    dtw = haversine_distance_nm(point["latitude"], point["longitude"], mark["latitude"], mark["longitude"])
    bearing = initial_bearing_deg(point["latitude"], point["longitude"], mark["latitude"], mark["longitude"])
    
    if dtw <= threshold_nm:
        return {
            "mark_name": mark["name"],
            "timestamp": point["timestamp"],
            "distance_nm": round(dtw, 4),
            "bearing_deg": bearing,
            "rounded": True
        }
    return None
