from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

pytestmark = pytest.mark.ui


def backend_bool(url: str, key: str) -> str | None:
    return (parse_qs(urlparse(url).query).get(key) or [None])[0]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_LIST_02(secrets_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SECRETS-LIST-02 保密字典列表：排序与翻页。"""

    e2e_objects["secret"](e2e_objects["unique"]())

    # Record what the page asks for, starting before the first paint: the default
    # order is itself part of the contract.
    seen: list[str] = []
    secrets_page.page.on(
        "request",
        lambda request: seen.append(request.url) if "/secrets?" in request.url and "sortBy=" in request.url else None,
    )
    secrets_page.open()
    assert seen, "the first page load must sort by createTime"
    first_ascending = backend_bool(seen[-1], "ascending")
    # Newest first, as the old console's default.
    assert first_ascending == "false", seen[-1]

    # Another column starts ascending.
    secrets_page.surface.locator('[data-ai-id="secrets:sort:name"]').click()
    secrets_page.page.wait_for_timeout(600)
    assert "sortBy=name" in seen[-1] and backend_bool(seen[-1], "ascending") == "true", seen[-1]
    assert "page=1" in seen[-1]
    assert secrets_page.surface.locator("thead th", has_text="名称").first.get_attribute("aria-sort") == "ascending"

    # Clicking the active column again flips it: name was ascending, now descending.
    secrets_page.surface.locator('[data-ai-id="secrets:sort:name"]').click()
    secrets_page.page.wait_for_timeout(600)
    assert "sortBy=name" in seen[-1] and backend_bool(seen[-1], "ascending") == "false", seen[-1]
    column = secrets_page.surface.locator("thead th", has_text="名称").first
    assert column.get_attribute("aria-sort") == "descending"
