"""The API client retries a truncated response instead of failing the case.

This cluster's list endpoints can return several megabytes, and the SSH tunnel in front of them
sometimes cuts the body mid-chunk. `urllib` raises `http.client.IncompleteRead` for that, which is
an `HTTPException` -- *not* an `OSError` -- so the original retry clause let it escape and every
case that read such a list failed with a traceback from `http.client`, which reads as a product
regression rather than a link problem (observed repeatedly on 2026-11-16).

These checks pin both halves of the behaviour: the truncated response is retried, and a real
answer (including a 4xx) is returned untouched instead of being retried into a timeout.
"""

from __future__ import annotations

import http.client

import pytest

from helpers.api import ApiClient


def make_client() -> ApiClient:
    """A client that never actually dials: `_once` is replaced per test."""

    return ApiClient('http://127.0.0.1:1', 'token')


def test_retries_a_truncated_body(monkeypatch):
    client = make_client()
    calls = {'count': 0}

    def flaky(_method, _path, _data, _content_type, _timeout, _json):
        calls['count'] += 1
        if calls['count'] == 1:
            raise http.client.IncompleteRead(b'partial', 4096)
        return 200, {'items': [], 'total': 0}

    monkeypatch.setattr(client, '_once', flaky)
    status, body = client.request('GET', '/api/v1/pods')

    assert calls['count'] == 2, '截断的响应必须重试一次'
    assert status == 200
    assert body == {'items': [], 'total': 0}


def test_gives_up_after_the_configured_attempts(monkeypatch):
    client = make_client()
    calls = {'count': 0}

    def always_truncated(*_args):
        calls['count'] += 1
        raise http.client.IncompleteRead(b'', 0)

    monkeypatch.setattr(client, '_once', always_truncated)
    with pytest.raises(http.client.IncompleteRead):
        client.request('GET', '/api/v1/pods', attempts=3)
    assert calls['count'] == 3, '一直失败时应在尝试次数用尽后抛出'


def test_does_not_retry_a_post(monkeypatch):
    client = make_client()
    calls = {'count': 0}

    def truncated(*_args):
        calls['count'] += 1
        raise http.client.IncompleteRead(b'', 0)

    monkeypatch.setattr(client, '_once', truncated)
    with pytest.raises(http.client.IncompleteRead):
        client.request('POST', '/api/v1/pods', body={'a': 1}, attempts=3)
    assert calls['count'] == 1, 'POST 不能重试：重试的创建会留下两个对象'


def test_returns_an_error_status_without_retrying(monkeypatch):
    client = make_client()
    calls = {'count': 0}

    def forbidden(*_args):
        calls['count'] += 1
        return 403, {'message': 'forbidden'}

    monkeypatch.setattr(client, '_once', forbidden)
    status, body = client.request('GET', '/api/v1/pods')

    assert (status, body) == (403, {'message': 'forbidden'})
    assert calls['count'] == 1, '有应答（即使是 4xx）不是故障，不该重试'
