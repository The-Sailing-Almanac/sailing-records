import unittest
from layline_scoring.tactics import haversine_distance_nm, initial_bearing_deg, detect_rounding

class TestTacticsMath(unittest.TestCase):
    def test_haversine_distance_and_bearing(self):
        # Point A (start pin) to Point B (weather mark) ~0.60 nm due North
        lat1, lon1 = 29.5000, -95.0000
        lat2, lon2 = 29.5100, -95.0000
        
        dist = haversine_distance_nm(lat1, lon1, lat2, lon2)
        bearing = initial_bearing_deg(lat1, lon1, lat2, lon2)
        
        self.assertAlmostEqual(dist, 0.60, places=1)
        self.assertAlmostEqual(bearing, 0.0, places=1)

    def test_detects_mark_rounding_in_zone(self):
        mark = {"name": "Weather Mark", "latitude": 29.510000, "longitude": -95.000000}
        
        # Boat 25 feet away (inside 0.025 nm threshold)
        inside_point = {
            "timestamp": "2026-09-19T13:00:00Z",
            "latitude": 29.510050,
            "longitude": -95.000020
        }
        event = detect_rounding(inside_point, mark, threshold_nm=0.025)
        self.assertIsNotNone(event)
        self.assertTrue(event["rounded"])
        self.assertEqual(event["mark_name"], "Weather Mark")

        # Boat 500 feet away (outside 0.025 nm threshold)
        outside_point = {
            "timestamp": "2026-09-19T12:55:00Z",
            "latitude": 29.505000,
            "longitude": -95.000000
        }
        self.assertIsNone(detect_rounding(outside_point, mark, threshold_nm=0.025))

if __name__ == "__main__":
    unittest.main()
