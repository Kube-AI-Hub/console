"""Read helpers that never confuse "the read failed" with "there is nothing".

The project rule is that a failed read must not be reported as an absence: a 502 or a 403 that
turns into `pytest.skip("集群没有 CRD")` hides a broken environment behind a green-ish suite.
Several case files grew exactly that helper -- `if status != 200: return None`, then
`if value is None: pytest.skip(...)` -- so a broken BFF looked like an empty cluster.

`read_list` returns the items only when the API answered 200 with a list; otherwise it fails the
case with the status and a body excerpt, which is the truthful report.
"""

from __future__ import annotations

from typing import Any


class ReadError(AssertionError):
    """The API did not answer with a usable list. Fails the case instead of skipping it."""


def read_list(api: Any, path: str, what: str) -> list[Any]:
    """`GET path` and return `items`, or raise `ReadError` if the API did not answer."""

    status, body = api.request("GET", path)
    if status != 200:
        excerpt = repr(body)[:300]
        raise ReadError(f"{what} 读取失败：HTTP {status} — {excerpt}")
    if not isinstance(body, dict):
        raise ReadError(f"{what} 读取失败：响应不是对象 — {type(body).__name__}")
    items = body.get("items")
    if items is None:
        # A list endpoint that answers 200 without `items` is a contract problem, not an empty list.
        raise ReadError(f"{what} 读取失败：响应没有 items 字段 — {repr(body)[:200]}")
    if not isinstance(items, list):
        raise ReadError(f"{what} 读取失败：items 不是数组 — {type(items).__name__}")
    return items