"""Regression tests for the spec ↔ test index.

The gate's slow path was here: `spec_path_for` rebuilt the whole spec table on every
call, and the caller ran it once per test file (483 x 483 YAML parses, ~5 minutes).
These tests pin the two properties that make the fast path safe — the index answers
exactly what the linear scan answered, and cached parses still notice a changed file.
"""

from __future__ import annotations

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import test_index  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SPECS = REPO / "tests" / "ui" / "specs"
UI_TESTS = REPO / "tests" / "ui" / "tests"


class ReverseIndexTests(unittest.TestCase):
    def test_index_answers_what_the_linear_scan_answers(self):
        if not SPECS.is_dir() or not UI_TESTS.is_dir():
            self.skipTest("specs/ or tests/ not present")
        index = test_index.reverse_index(SPECS, UI_TESTS)
        spec_paths = list(test_index.specs(SPECS).values())
        self.assertGreater(len(spec_paths), 100, "expected a populated spec tree")
        checked = 0
        for position, spec_path in enumerate(spec_paths):
            test_path = test_index.test_path_for(spec_path, SPECS, UI_TESTS)
            if not test_path.is_file():
                continue
            self.assertEqual(index.get(test_path), spec_path)
            # The indexed answer must equal the linear scan's. Comparing all 400+ would
            # re-scan the tree per spec (the very cost this index removes), so sample.
            if position % 40 == 0:
                self.assertEqual(
                    test_index.spec_path_for(test_path, SPECS, UI_TESTS, index=index),
                    test_index.spec_path_for(test_path, SPECS, UI_TESTS),
                )
            checked += 1
        self.assertGreater(checked, 100, "expected most specs to have a test file")

    def test_unknown_test_path_falls_back_to_the_mirror_path(self):
        """An unmatched test path still yields a path for the error message.

        The fallback is the mirrored location (same stem, .yaml). It is not expected to
        exist — the caller reports it as "找不到对应的用例规格" — so only the shape is
        pinned, and the `test_` stem is kept because that is what the message has always
        shown.
        """
        index = test_index.reverse_index(SPECS, UI_TESTS) if SPECS.is_dir() else {}
        stray = UI_TESTS / "cluster-management" / "test_TC_L3_NOPE_01.py"
        expected = SPECS / "cluster-management" / "test_TC_L3_NOPE_01.yaml"
        self.assertEqual(
            test_index.spec_path_for(stray, SPECS, UI_TESTS, index=index), expected
        )


class ParseCacheTests(unittest.TestCase):
    def test_a_rewritten_spec_is_read_again(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "TC-L3-X-Y-01.yaml"
            path.write_text("id: TC-L3-X-Y-01\nsteps: [a]\n", encoding="utf-8")
            self.assertEqual(test_index.load_spec(path)["steps"], ["a"])
            # Same path, different content. Rewriting in the same nanosecond is possible
            # on a coarse clock, so make the new content a different size too: the cache
            # keys on (mtime_ns, size) and either one alone is enough.
            time.sleep(0.01)
            path.write_text("id: TC-L3-X-Y-01\nsteps: [a, b, c]\n", encoding="utf-8")
            os.utime(path, None)
            self.assertEqual(test_index.load_spec(path)["steps"], ["a", "b", "c"])

    def test_a_rewritten_test_module_is_parsed_again(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "test_TC_L3_X_Y_01.py"
            path.write_text("def test_a():\n    pass\n", encoding="utf-8")
            self.assertEqual([n.name for n in test_index.test_functions(path)], ["test_a"])
            time.sleep(0.01)
            path.write_text("def test_a():\n    pass\n\ndef test_b():\n    pass\n", encoding="utf-8")
            os.utime(path, None)
            self.assertEqual(
                [n.name for n in test_index.test_functions(path)], ["test_a", "test_b"]
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
