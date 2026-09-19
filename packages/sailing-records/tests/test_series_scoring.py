import unittest
from layline_scoring.series import score_race, score_series

class TestSeriesScoring(unittest.TestCase):
    def test_single_race_penalties(self):
        race = [
            {"sail_number": "USA 101", "place": 1},
            {"sail_number": "USA 202", "place": 2},
            {"sail_number": "USA 303", "code": "OCS"},
            {"sail_number": "USA 404", "code": "DNF"}
        ]
        scored = score_race(race, fleet_size=4)
        scores_by_boat = {s["sail_number"]: s["points"] for s in scored}
        
        self.assertEqual(scores_by_boat["USA 101"], 1.0)
        self.assertEqual(scores_by_boat["USA 202"], 2.0)
        self.assertEqual(scores_by_boat["USA 303"], 5.0)  # fleet_size + 1
        self.assertEqual(scores_by_boat["USA 404"], 5.0)

    def test_series_with_discard(self):
        # 3 races, 1 discard: boat with [1, 1, 5] drops the 5 -> net 2.0
        r1 = [{"sail_number": "USA 101", "place": 1}, {"sail_number": "USA 202", "place": 2}]
        r2 = [{"sail_number": "USA 101", "place": 1}, {"sail_number": "USA 202", "place": 2}]
        r3 = [{"sail_number": "USA 101", "code": "DSQ"}, {"sail_number": "USA 202", "place": 1}]
        
        leaderboard = score_series([r1, r2, r3], fleet_size=2, discards=1)
        b101 = next(b for b in leaderboard if b["sail_number"] == "USA 101")
        b202 = next(b for b in leaderboard if b["sail_number"] == "USA 202")
        
        # USA 101: races [1.0, 1.0, 3.0], discard [3.0] -> net 2.0
        self.assertEqual(b101["net_points"], 2.0)
        self.assertEqual(b101["rank"], 1)
        
        # USA 202: races [2.0, 2.0, 1.0], discard [2.0] -> net 3.0
        self.assertEqual(b202["net_points"], 3.0)
        self.assertEqual(b202["rank"], 2)

if __name__ == "__main__":
    unittest.main()
