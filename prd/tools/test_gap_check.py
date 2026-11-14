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

    def test_unregistered_snapshot_routes_are_reported(self):
        # Both routes shipped with the snapshot-content work: `/snapshots` is a redirect and
        # `/volume-snapshot-content/<name>` a detail page. What must stay true is that a
        # segment with no matching route and no registration is reported, not silently dropped.
        for segment in ("snapshots", "volume-snapshot-content"):
            with self.subTest(segment=segment):
                self.assertEqual(gap_check.classify("clusters", segment, set())[0], "untracked")

    def test_registered_segment_without_route_is_reported(self):
        # A registration is a decision, not proof: once its route directory is gone the
        # segment must fall back to the unregistered bucket instead of being reported as done.
        for segment in ("snapshots", "volume-snapshot-content"):
            with self.subTest(segment=segment):
                category, _ = gap_check.classify("clusters", segment, set())
                self.assertNotEqual(category, "migrated")


if __name__ == "__main__":
    unittest.main()
