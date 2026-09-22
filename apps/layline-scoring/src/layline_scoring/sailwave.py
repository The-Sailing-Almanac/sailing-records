"""
Sailwave Export & Ingestion Bridge (layline-scoring)
Generates compliant Sailwave CSV interchange files and exports race series.
"""
import csv
import io
from typing import List, Dict, Any, Optional
from layline_scoring.scoring import format_hms

SAILWAVE_DEFAULT_FIELDS = [
    "Rank",
    "SailNo",
    "Boat",
    "HelmName",
    "Rating",
    "Elapsed",
    "Corrected",
    "Points"
]

def export_race_to_sailwave_csv(results: List[Dict[str, Any]]) -> str:
    """
    Serializes a scored race finish list into a Sailwave-compatible CSV format.
    Expects each entry to contain:
    - sail_number: str
    - boat_name: Optional[str]
    - skipper: Optional[str]
    - rating: Optional[Any]
    - elapsed_seconds: Optional[float]
    - corrected_seconds: Optional[float]
    - points: float
    - rank: Optional[int]
    - code: Optional[str]
    """
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")
    
    # Sailwave header
    writer.writerow(SAILWAVE_DEFAULT_FIELDS)
    
    for idx, r in enumerate(results, start=1):
        rank = r.get("rank") or idx
        sail = r.get("sail_number", "")
        boat = r.get("boat_name", "")
        helm = r.get("skipper", "")
        rating = str(r.get("rating", ""))
        
        code = r.get("code")
        if code:
            elapsed_str = code
            corrected_str = code
        else:
            elapsed = r.get("elapsed_seconds")
            corrected = r.get("corrected_seconds")
            elapsed_str = format_hms(elapsed) if elapsed is not None else ""
            corrected_str = format_hms(corrected) if corrected is not None else ""
            
        points = f"{r.get('points', 0.0):.1f}"
        
        writer.writerow([
            rank,
            sail,
            boat,
            helm,
            rating,
            elapsed_str,
            corrected_str,
            points
        ])
        
    return output.getvalue()
