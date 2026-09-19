import unittest
from layline_scoring.scoring import calculate_tod, calculate_tot, format_hms

class TestScoringMath(unittest.TestCase):
    def test_phrf_time_on_distance(self):
        # 10nm race, 2 hours (7200s) elapsed, boat rating 90
        # Allowance = 90 * 10 = 900s
        # Corrected = 7200 - 900 = 6300s (01:45:00)
        corrected = calculate_tod(elapsed_seconds=7200.0, distance_nm=10.0, phrf_rating=90.0)
        self.assertEqual(corrected, 6300.0)
        self.assertEqual(format_hms(corrected), "01:45:00")

    def test_phrf_time_on_time(self):
        # Elapsed 3600s, rating 100, default A=650, B=550 -> TCF = 650/650 = 1.0
        corrected = calculate_tot(elapsed_seconds=3600.0, phrf_rating=100.0)
        self.assertEqual(corrected, 3600.0)
        self.assertEqual(format_hms(corrected), "01:00:00")

    def test_invalid_distance_raises(self):
        with self.assertRaises(ValueError):
            calculate_tod(elapsed_seconds=3600.0, distance_nm=0.0, phrf_rating=100.0)

if __name__ == "__main__":
    unittest.main()
