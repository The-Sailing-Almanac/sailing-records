import unittest
import sqlite3
from layline_scoring.db import init_trophy_db, record_race_results

class TestAlmanacDatabaseBridge(unittest.TestCase):
    def test_init_and_record_results(self):
        conn = init_trophy_db(":memory:")
        results = [
            {
                "sail_number": "USA 101",
                "boat_name": "Outrageous",
                "skipper": "Woodyard",
                "rating": 90.0,
                "elapsed_seconds": 3600.0,
                "corrected_seconds": 3150.0,
                "points": 1.0,
                "rank": 1
            },
            {
                "sail_number": "USA 202",
                "boat_name": "Wind Dancer",
                "skipper": "Smith",
                "rating": 105.0,
                "elapsed_seconds": 3720.0,
                "corrected_seconds": 3210.0,
                "points": 2.0,
                "rank": 2
            }
        ]
        regatta_id = record_race_results(conn, "RUM Races", 2026, 1, results)
        self.assertGreater(regatta_id, 0)

        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM race_results WHERE regatta_id = ?", (regatta_id,))
        count = cur.fetchone()[0]
        self.assertEqual(count, 2)

        cur.execute("SELECT sail_number, points FROM race_results WHERE rank = 1")
        winner = cur.fetchone()
        self.assertEqual(winner["sail_number"], "USA 101")
        self.assertEqual(winner["points"], 1.0)

if __name__ == "__main__":
    unittest.main()
