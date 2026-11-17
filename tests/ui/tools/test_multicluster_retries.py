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


def outcome(**overrides):
    """A successful member-cluster write, with fields replaced per case."""
    base = {
        'cluster': 'xc',
        'name': 'tc-sweep-x',
        'created': 201,
        'on_target': True,
        'on_host': False,
        'deleted': 200,
        'gone': True,
    }
    base.update(overrides)
    return base


def test_write_verdict_accepts_a_clean_member_write():
    assert sweep.write_verdict(outcome()) is True


def test_write_verdict_accepts_a_clean_host_write():
    # On the host the object is *expected* to be on the host.
    assert sweep.write_verdict(outcome(cluster='host', on_host=True)) is True


@pytest.mark.parametrize(
    'change',
    [
        # The original bug: a member write that landed on the host.
        {'on_host': True},
        # Never appeared where it was sent.
        {'on_target': False},
        # A 5xx from the console is not a create.
        {'created': 503},
        # Delete said 200 but the object is still there.
        {'gone': False},
        # Delete was refused.
        {'deleted': 403},
    ],
)
def test_write_verdict_rejects(change):
    assert sweep.write_verdict(outcome(**change)) is False


@pytest.mark.parametrize(
    'status,url,expected',
    [
        # The permission review probes the IAM aggregated route and falls back when it is missing.
        # Both deployments answer 500 there, so every page carries this one request.
        (500, '/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews', True),
        # A 500 on any other route is a real failure.
        (500, '/kapis/tenant.kubesphere.io/v1alpha2/workspaces', False),
        # Member clusters cannot serve quotas or limit ranges (constitution C6).
        (404, '/kapis/resources.kubesphere.io/v1alpha3/namespaces/x/resourcequotas', True),
        (404, '/kapis/resources.kubesphere.io/v1alpha3/namespaces/x/limitranges', True),
        # A 404 anywhere else stays a failure.
        (404, '/kapis/resources.kubesphere.io/v1alpha3/namespaces/x/configmaps', False),
        (403, '/kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews', False),
    ],
)
def test_expected_failures(status, url, expected):
    assert sweep._is_expected_failure(status, url) is expected

def test_login_urls_try_the_new_transport_first():
    """The console moved sign-in from the BFF to ks-apiserver on 2026-11-18; the sweep follows."""
    urls = sweep.login_urls('http://localhost:5182', 'http://127.0.0.1:8093')
    assert urls[0] == 'http://localhost:5182/kapis/oauth.kubesphere.io/v1alpha1/login'
    # The retired BFF route is still tried, on both origins, so an un-upgraded deployment works.
    assert 'http://localhost:5182/api/session/login' in urls
    assert 'http://127.0.0.1:8093/api/session/login' in urls


def test_login_urls_do_not_repeat_one_origin():
    urls = sweep.login_urls('http://localhost:5182/', 'http://localhost:5182')
    assert urls == [
        'http://localhost:5182/kapis/oauth.kubesphere.io/v1alpha1/login',
        'http://localhost:5182/api/session/login',
    ]


@pytest.mark.parametrize(
    'url,expected',
    [
        ('/api/session/me', True),
        ('/oauth/userinfo', True),
        ('/oauth/userinfo?x=1', True),
        ('/kapis/resources.kubesphere.io/v1alpha3/pods', False),
        ('/kapis/oauth.kubesphere.io/v1alpha1/login', False),
    ],
)
def test_session_probes(url, expected):
    assert sweep._is_session_probe(url) is expected
