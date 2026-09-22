import unittest
import csv
import io
from layline_scoring.orc import (
    ORCTripleNumber,
    WindBand,
    calculate_orc_tot,
    calculate_orc_tod,
    calculate_orc_triple_number,
    round_seconds
)
from layline_scoring.sailwave import export_race_to_sailwave_csv

class TestORCScoring(unittest.TestCase):
    def test_round_seconds(self):
        self.assertEqual(round_seconds(100.4), 100)
        self.assertEqual(round_seconds(100.5), 101)
        self.assertEqual(round_seconds(100.6), 101)

    def test_orc_tot_exact(self):
        # 3600s elapsed, TCC 1.0500 -> 3780s
        corrected = calculate_orc_tot(3600.0, 1.0500)
        self.assertEqual(corrected, 3780)

        # Rounding check: 3601s * 1.0250 = 3691.025 -> 3691
        corrected2 = calculate_orc_tot(3601.0, 1.0250)
        self.assertEqual(corrected2, 3691)

    def test_orc_tod_allowance(self):
        # 10nm, 7200s elapsed, allowance 600s/nm -> 7200 - 6000 = 1200s
        corrected = calculate_orc_tod(7200.0, distance_nm=10.0, allowance_sec_nm=600.0)
        self.assertEqual(corrected, 1200)

    def test_orc_triple_number_wind_bands(self):
        ratings = ORCTripleNumber(low=0.8500, medium=1.0000, high=1.1500)
        elapsed = 4000.0

        # Low air (< 9 kt) -> 4000 * 0.85 = 3400s
        self.assertEqual(calculate_orc_triple_number(elapsed, 7.5, ratings), 3400)
        
        # Medium air (9 to 14 kt) -> 4000 * 1.0 = 4000s
        self.assertEqual(calculate_orc_triple_number(elapsed, 12.0, ratings), 4000)
        
        # High air (> 14 kt) -> 4000 * 1.15 = 4600s
        self.assertEqual(calculate_orc_triple_number(elapsed, 18.0, ratings), 4600)

    def test_sailwave_export(self):
        results = [
            {
                "rank": 1,
                "sail_number": "USA 101",
                "boat_name": "Outrageous",
                "skipper": "Woodyard",
                "rating": 1.050,
                "elapsed_seconds": 3600.0,
                "corrected_seconds": 3780.0,
                "points": 1.0
            },
            {
                "rank": 2,
                "sail_number": "USA 202",
                "boat_name": "Slipstream",
                "skipper": "Smith",
                "rating": 1.020,
                "code": "DNF",
                "points": 3.0
            }
        ]
        
        csv_output = export_race_to_sailwave_csv(results)
        reader = list(csv.reader(io.StringIO(csv_output)))
        
        # Verify headers
        self.assertEqual(reader[0], ["Rank", "SailNo", "Boat", "HelmName", "Rating", "Elapsed", "Corrected", "Points"])
        
        # Verify 1st place
        self.assertEqual(reader[1][0], "1")
        self.assertEqual(reader[1][1], "USA 101")
        self.assertEqual(reader[1][5], "01:00:00")
        self.assertEqual(reader[1][6], "01:03:00")
        self.assertEqual(reader[1][7], "1.0")
        
        # Verify penalty code representation
        self.assertEqual(reader[2][0], "2")
        self.assertEqual(reader[2][1], "USA 202")
        self.assertEqual(reader[2][5], "DNF")
        self.assertEqual(reader[2][6], "DNF")
        self.assertEqual(reader[2][7], "3.0")

if __name__ == "__main__":
    unittest.main()
