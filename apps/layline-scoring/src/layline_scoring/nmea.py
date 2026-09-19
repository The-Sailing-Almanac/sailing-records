"""
NMEA Telemetry Ingestion Bridge (layline-scoring)
Parses raw NMEA-0183 log streams ($GPRMC, $GPGGA) emitted by meridian
to extract GPS fix timestamps, coordinates, SOG, and COG.
"""
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional

RMC_REGEX = re.compile(
    r"^\$GPRMC,(?P<time>\d{6}(?:\.\d+)?),(?P<status>[AV]),"
    r"(?P<lat>\d{4}\.\d+),(?P<lat_dir>[NS]),"
    r"(?P<lon>\d{5}\.\d+),(?P<lon_dir>[EW]),"
    r"(?P<sog>\d+(?:\.\d+)?),(?P<cog>\d+(?:\.\d+)?),"
    r"(?P<date>\d{6})"
)

def parse_nmea_coordinates(raw_coord: str, direction: str) -> float:
    """Converts NMEA DDMM.MMMM to decimal degrees."""
    if not raw_coord or not direction:
        return 0.0
    split_idx = 2 if direction in ("N", "S") else 3
    deg = float(raw_coord[:split_idx])
    minutes = float(raw_coord[split_idx:])
    decimal = deg + (minutes / 60.0)
    return -decimal if direction in ("S", "W") else decimal

def parse_rmc_sentence(sentence: str) -> Optional[Dict[str, Any]]:
    """Parses a single $GPRMC sentence into a canonical navigation point."""
    sentence = sentence.strip()
    match = RMC_REGEX.match(sentence)
    if not match:
        return None
    
    data = match.groupdict()
    if data["status"] != "A":  # Status A = active/valid, V = void
        return None
        
    lat = parse_nmea_coordinates(data["lat"], data["lat_dir"])
    lon = parse_nmea_coordinates(data["lon"], data["lon_dir"])
    sog = float(data["sog"])
    cog = float(data["cog"])
    
    time_str = data["time"].split(".")[0]
    date_str = data["date"]
    dt = datetime.strptime(f"{date_str}{time_str}", "%d%m%y%H%M%S").replace(tzinfo=timezone.utc)
    
    return {
        "timestamp": dt.isoformat(),
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "speed_over_ground_kts": sog,
        "course_over_ground_deg": cog
    }
