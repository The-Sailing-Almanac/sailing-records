import unittest
from layline_scoring.nmea import parse_rmc_sentence

class TestNmeaIngestion(unittest.TestCase):
    def test_parses_valid_gprmc(self):
        sentence = "$GPRMC,123519.000,A,2945.1234,N,09521.5678,W,6.5,185.2,190926,,,A*77"
        point = parse_rmc_sentence(sentence)
        
        self.assertIsNotNone(point)
        self.assertEqual(point["speed_over_ground_kts"], 6.5)
        self.assertEqual(point["course_over_ground_deg"], 185.2)
        self.assertAlmostEqual(point["latitude"], 29.752057, places=5)
        self.assertAlmostEqual(point["longitude"], -95.359463, places=5)
        self.assertIn("2026-09-19T12:35:19", point["timestamp"])

    def test_ignores_void_gprmc(self):
        sentence = "$GPRMC,123519.000,V,2945.1234,N,09521.5678,W,6.5,185.2,190926,,,A*77"
        self.assertIsNone(parse_rmc_sentence(sentence))

if __name__ == "__main__":
    unittest.main()
