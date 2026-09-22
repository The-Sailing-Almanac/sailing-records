"""
Offshore Racing Congress (ORC) Scoring Engine (layline-scoring)
Implements ORC rating calculations:
- Single Number Time-on-Time (TOT)
- Single Number Time-on-Distance (TOD)
- Triple Number (Low, Medium, High wind bands) for Inshore / Coastal courses
"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, Any

class WindBand(str, Enum):
    LOW = "low"        # < 9 knots
    MEDIUM = "medium"  # 9 - 14 knots
    HIGH = "high"      # > 14 knots

class CourseType(str, Enum):
    WINDWARD_LEEWARD = "windward_leeward"
    COASTAL = "coastal"

@dataclass(frozen=True)
class ORCTripleNumber:
    """Represents a vessel's ORC Triple Number rating coefficients."""
    low: float
    medium: float
    high: float

    def get_tcf(self, wind: WindBand) -> float:
        if wind == WindBand.LOW:
            return self.low
        elif wind == WindBand.MEDIUM:
            return self.medium
        elif wind == WindBand.HIGH:
            return self.high
        raise ValueError(f"Unknown wind band: {wind}")

def round_seconds(seconds: float) -> int:
    """
    Rounds seconds to the nearest whole integer per ORC rules 
    (0.5 rounds up).
    """
    return int(seconds + 0.5)

def calculate_orc_tot(elapsed_seconds: float, tcc: float) -> int:
    """
    ORC Time-on-Time (TOT):
    Corrected Time = round(Elapsed Time * TCC)
    """
    if elapsed_seconds < 0:
        raise ValueError("Elapsed time must be non-negative.")
    if tcc <= 0:
        raise ValueError("TCC/TCF rating must be positive.")
    return round_seconds(elapsed_seconds * tcc)

def calculate_orc_tod(elapsed_seconds: float, distance_nm: float, allowance_sec_nm: float) -> int:
    """
    ORC Time-on-Distance (TOD):
    Corrected Time = round(Elapsed Time - (Allowance * Distance))
    """
    if distance_nm <= 0:
        raise ValueError("Distance must be greater than zero nautical miles.")
    time_allowance = allowance_sec_nm * distance_nm
    corrected = max(0.0, elapsed_seconds - time_allowance)
    return round_seconds(corrected)

def calculate_orc_triple_number(
    elapsed_seconds: float,
    wind_speed_kts: float,
    triple_number: ORCTripleNumber
) -> int:
    """
    Evaluates wind speed into Low/Medium/High band and scores via TOT.
    - Low: < 9.0 kts
    - Medium: 9.0 to 14.0 kts
    - High: > 14.0 kts
    """
    if wind_speed_kts < 9.0:
        band = WindBand.LOW
    elif wind_speed_kts <= 14.0:
        band = WindBand.MEDIUM
    else:
        band = WindBand.HIGH

    tcf = triple_number.get_tcf(band)
    return calculate_orc_tot(elapsed_seconds, tcf)
