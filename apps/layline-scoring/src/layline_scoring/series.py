"""
One-Design Series Scoring Engine (layline-scoring)
Implements Racing Rules of Sailing (RRS) Appendix A Low Point System:
- Finishing places scored as integer points (1st = 1.0, 2nd = 2.0, etc.)
- Configurable discard/throwout counts based on races completed
- Scoring abbreviations (DNF, DNS, DSQ, OCS, RET) scored as fleet_size + 1
- Tiebreakers resolved according to RRS A8.1 (most 1sts, then 2nds)
"""
from typing import List, Dict, Any, Optional

PENALTY_CODES = {"DNF", "DNS", "DSQ", "OCS", "RET", "DNE"}

def score_race(finishes: List[Dict[str, Any]], fleet_size: int) -> List[Dict[str, Any]]:
    """
    Scores an individual race for a fleet.
    Each finish dict expects: {"sail_number": str, "place": Optional[int], "code": Optional[str]}
    """
    scored = []
    penalty_score = float(fleet_size + 1)
    
    for f in finishes:
        sail = f["sail_number"]
        code = f.get("code")
        place = f.get("place")
        
        if code and code.upper() in PENALTY_CODES:
            pts = penalty_score
            actual_code = code.upper()
        elif place is not None and place > 0:
            pts = float(place)
            actual_code = None
        else:
            pts = penalty_score
            actual_code = "DNS"
            
        scored.append({
            "sail_number": sail,
            "points": pts,
            "code": actual_code
        })
    return scored

def score_series(
    races: List[List[Dict[str, Any]]], 
    fleet_size: int, 
    discards: int = 1
) -> List[Dict[str, Any]]:
    """
    Computes series total scores across multiple races with discard rules.
    """
    boat_scores: Dict[str, List[float]] = {}
    
    for race in races:
        scored_race = score_race(race, fleet_size)
        for entry in scored_race:
            sail = entry["sail_number"]
            boat_scores.setdefault(sail, []).append(entry["points"])
            
    leaderboard = []
    for sail, scores in boat_scores.items():
        total_gross = sum(scores)
        if discards > 0 and len(scores) > discards:
            sorted_scores = sorted(scores)
            discarded = sorted_scores[-discards:]
            net_points = sum(sorted_scores[:-discards])
        else:
            discarded = []
            net_points = total_gross
            
        leaderboard.append({
            "sail_number": sail,
            "races": scores,
            "discarded": discarded,
            "gross_points": total_gross,
            "net_points": net_points
        })
        
    # Sort leaderboard by net points ascending
    leaderboard.sort(key=lambda x: (x["net_points"], sorted(x["races"])))
    for rank, entry in enumerate(leaderboard, start=1):
        entry["rank"] = rank
        
    return leaderboard
