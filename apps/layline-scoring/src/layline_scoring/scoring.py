"""
PHRF & One-Design Race Scoring Engine (layline-scoring)
Implements standard US Sailing / PHRF handicap models:
- Time-on-Distance (TOD)
- Time-on-Time (TOT)
"""
from typing import Dict, Any, Optional

def calculate_tod(elapsed_seconds: float, distance_nm: float, phrf_rating: float) -> float:
    """
    Time-on-Distance (TOD):
    Corrected Time (sec) = Elapsed Time (sec) - (PHRF Rating * Distance (nm))
    """
    if distance_nm <= 0:
        raise ValueError("Distance must be greater than zero nautical miles.")
    time_allowance = phrf_rating * distance_nm
    return max(0.0, elapsed_seconds - time_allowance)

def calculate_tot(
    elapsed_seconds: float, 
    phrf_rating: float, 
    b_factor: float = 550.0, 
    a_factor: float = 650.0
) -> float:
    """
    Time-on-Time (TOT):
    Time Correction Factor (TCF) = A / (B + PHRF Rating)
    Corrected Time (sec) = Elapsed Time (sec) * TCF
    
    Standard offshore default: A=650, B=550 (moderate conditions)
    Light air default: B=480, Heavy air default: B=600
    """
    divisor = b_factor + phrf_rating
    if divisor <= 0:
        raise ValueError(f"Invalid B-factor and rating combination: {divisor}")
    tcf = a_factor / divisor
    return elapsed_seconds * tcf

def format_hms(seconds: float) -> str:
    """Formats decimal seconds into HH:MM:SS."""
    total_sec = int(round(seconds))
    hrs = total_sec // 3600
    mins = (total_sec % 3600) // 60
    secs = total_sec % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"
