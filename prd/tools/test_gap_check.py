"""Regression tests for the URL-segment migration inventory."""

import unittest

import gap_check


class GapClassificationTests(unittest.TestCase):
    def test_cluster_snapshot_uses_its_own_route_name(self):
        self.assertEqual(
            gap_check.classify("clusters", "volume-snapshots", {"volume-snapshots"}),
            ("migrated", ""),
        )

    def test_project_snapshot_keeps_its_distinct_route_name(self):
        self.assertEqual(
            gap_check.classify("projects", "volume-snapshots", {"volumesnapshots"}),
            ("migrated", "volumesnapshots"),
        )

    def test_unimplemented_snapshot_routes_remain_visible(self):
        for segment in ("snapshots", "volume-snapshot-content"):
            with self.subTest(segment=segment):
                self.assertEqual(gap_check.classify("clusters", segment, set())[0], "planned")

    def test_existing_route_reports_stale_registration(self):
        category, note = gap_check.classify("clusters", "snapshots", {"snapshots"})
        self.assertEqual(category, "migrated")
        self.assertIn("登记过期", note)


if __name__ == "__main__":
    unittest.main()
