"""The retry rules of the multi-cluster sweep, without a cluster.

Each of these decisions was written inline inside a 900-line sweep and only ever exercised on the
happy path: the retries fire when the upstream hiccups, which is exactly when nobody is watching the
tool's own logic. Pulling them out lets a plain unit test pin the boundaries -- a 5xx retries once, a
404 does not, and a page that rendered fine is never reloaded.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location('multicluster_sweep', Path(__file__).with_name('multicluster_sweep.py'))
sweep = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(sweep)


@pytest.mark.parametrize(
    'state,failures,expected',
    [
        ('error', [(503, '/a')], True),
        ('none', [(500, '/a'), (502, '/b')], True),
        # A rendered page is not reloaded, whatever failed behind it.
        ('ready', [(503, '/a')], False),
        # A real answer is not a hiccup: retrying would only make the failure slower.
        ('error', [(404, '/a')], False),
        ('error', [(403, '/a')], False),
        ('error', [(503, '/a'), (404, '/b')], False),
        # Nothing failed, so nothing to retry.
        ('error', [], False),
        ('none', [], False),
    ],
)
def test_should_retry_page(state, failures, expected):
    assert sweep.should_retry_page(state, failures) is expected


@pytest.mark.parametrize(
    'failures,expected',
    [
        ([(503, '/a')], True),
        ([(500, '/a'), (504, '/b')], True),
        ([(404, '/a')], False),
        ([(503, '/a'), (401, '/b')], False),
        ([], False),
    ],
)
def test_should_retry_tab(failures, expected):
    assert sweep.should_retry_tab(failures) is expected
