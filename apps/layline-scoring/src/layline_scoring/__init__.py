"""
layline-scoring: Pure-Python Regatta Scoring Engine
Supports PHRF, ORC, One-Design (RRS Appendix A), and Sailwave interchange.
"""
__version__ = "1.0.0"

from layline_scoring.scoring import calculate_tod, calculate_tot, format_hms
from layline_scoring.series import score_race, score_series
from layline_scoring.orc import (
    WindBand,
    CourseType,
    ORCTripleNumber,
    calculate_orc_tot,
    calculate_orc_tod,
    calculate_orc_triple_number,
    round_seconds,
)
from layline_scoring.sailwave import export_race_to_sailwave_csv
from layline_scoring.db import init_trophy_db, record_race_results

__all__ = [
    "__version__",
    "calculate_tod",
    "calculate_tot",
    "format_hms",
    "score_race",
    "score_series",
    "WindBand",
    "CourseType",
    "ORCTripleNumber",
    "calculate_orc_tot",
    "calculate_orc_tod",
    "calculate_orc_triple_number",
    "round_seconds",
    "export_race_to_sailwave_csv",
    "init_trophy_db",
    "record_race_results",
]
