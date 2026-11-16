"""Self-checks for `helpers.reads` (no browser, no cluster)."""

from __future__ import annotations

import pytest

from helpers.reads import ReadError, read_list


class FakeApi:
    def __init__(self, status: int, body):
        self.status = status
        self.body = body
        self.calls: list[str] = []

    def request(self, method: str, path: str):
        self.calls.append(f'{method} {path}')
        return self.status, self.body


def test_returns_the_items_when_the_api_answers():
    api = FakeApi(200, {'items': [{'metadata': {'name': 'a'}}]})
    assert read_list(api, '/x', '对象') == [{'metadata': {'name': 'a'}}]
    assert api.calls == ['GET /x']


def test_returns_an_empty_list_when_there_really_is_nothing():
    assert read_list(FakeApi(200, {'items': []}), '/x', '对象') == []


def test_fails_instead_of_skipping_when_the_read_fails():
    with pytest.raises(ReadError) as error:
        read_list(FakeApi(502, {'code': 'upstream_unreachable'}), '/x', 'CRD 列表')
    message = str(error.value)
    assert 'CRD 列表 读取失败' in message
    assert '502' in message
    assert 'upstream_unreachable' in message


def test_fails_on_a_forbidden_read():
    with pytest.raises(ReadError) as error:
        read_list(FakeApi(403, {'message': 'forbidden'}), '/x', '节点指标')
    assert '403' in str(error.value)


def test_fails_when_items_is_missing_or_not_a_list():
    with pytest.raises(ReadError):
        read_list(FakeApi(200, {'total': 0}), '/x', '对象')
    with pytest.raises(ReadError):
        read_list(FakeApi(200, {'items': {'a': 1}}), '/x', '对象')


def test_is_an_assertion_error_so_a_case_fails_loudly():
    # pytest reports AssertionError as a failure (not an error) and keeps the message.
    assert issubclass(ReadError, AssertionError)
