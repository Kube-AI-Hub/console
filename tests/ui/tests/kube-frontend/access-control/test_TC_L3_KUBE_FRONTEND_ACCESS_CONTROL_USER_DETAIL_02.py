from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_USER_DETAIL_02(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02 用户详情：登录历史分页与四列。"""

    ui = access_control_page
    assert ui.api is not None

    status, body = ui.api.request("GET", f"{USERS}?limit=-1")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("无法读取用户列表")
    names = [item["metadata"]["name"] for item in (body.get("items") or [])]
    if not names:
        pytest.skip("平台没有用户")

    chosen = None
    page1 = page2 = None
    for name in (["admin"] if "admin" in names else []) + names:
        st, records = ui.api.request("GET", f"{USERS}/{name}/loginrecords?limit=10&page=1&sortBy=createTime&ascending=false")
        if st != 200 or not isinstance(records, dict):
            continue
        total = int(records.get("totalItems") or 0)
        if total <= 10:
            continue
        st2, records2 = ui.api.request("GET", f"{USERS}/{name}/loginrecords?limit=10&page=2&sortBy=createTime&ascending=false")
        if st2 != 200 or not isinstance(records2, dict):
            continue
        chosen = name
        page1, page2 = records, records2
        break
    if not chosen or not page1 or not page2:
        pytest.skip("没有 totalItems>10 的登录历史，无法验收分页")

    items1 = page1.get("items") or []
    items2 = page2.get("items") or []
    total = int(page1.get("totalItems") or 0)
    first1 = (items1[0].get("metadata") or {}).get("name") if items1 else ""
    first2 = (items2[0].get("metadata") or {}).get("name") if items2 else ""
    assert first1 and first2 and first1 != first2, (first1, first2)

    ui.page.goto(f"{ui.base_url}/kube-frontend/access/users/{chosen}")
    detail = ui.page.locator('[data-ai-id="user-detail:surface"]').last
    expect(detail).to_be_visible(timeout=30_000)
    expect(detail).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    logins = ui.page.locator('[data-ai-id="user-detail:logins"]')
    expect(logins).to_be_visible(timeout=20_000)
    expect(ui.page.locator('[data-ai-id="user-detail:login-total"]')).to_contain_text(str(total), timeout=20_000)
    headers = [t.strip() for t in logins.locator("thead th").all_inner_texts() if t.strip()]
    for label in ("时间", "状态", "来源 IP", "原因"):
        assert label in headers, headers
    expect(ui.page.locator('[data-ai-id="user-detail:login-list"] [data-ai-row]')).to_have_count(len(items1), timeout=20_000)

    ui.page.locator('[data-ai-id="user-detail:logins:page:next"]').click()
    expect(ui.page.locator(f'[data-ai-id="user-detail:login-list"] [data-ai-row="{first2}"]')).to_be_visible(timeout=20_000)
    expect(ui.page.locator(f'[data-ai-id="user-detail:login-list"] [data-ai-row="{first1}"]')).to_have_count(0)
    expect(ui.page.locator('[data-ai-id="user-detail:login-total"]')).to_contain_text(str(total))
    screenshot(ui.page, "user-detail-logins-page2")
