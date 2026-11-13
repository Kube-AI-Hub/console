from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_DETAIL_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03 负载详情：容器组与服务的专属属性。"""

    ui = app_workloads_page
    page = ui.page
    seen: dict[str, list[str]] = {}

    # `spaces` is the project with real pods and services; the fixture's default
    # project is empty, so navigate there explicitly rather than via `ui.open()`.
    root = ui.base.replace("/projects/default", "/projects/spaces")
    for kind, expected in (
        ("pods", ["状态", "所在节点", "容器组 IP", "节点 IP", "QoS 等级", "重启次数"]),
        ("services", ["服务类型", "虚拟 IP", "外部地址", "选择器", "会话亲和性"]),
    ):
        page.goto(f"{root}/{kind}")
        expect(page.locator(f'[data-ai-id="{kind}:surface"]')).to_be_visible(timeout=30_000)
        expect(page.locator(f'[data-ai-id="{kind}:surface"]')).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        link = page.locator(f'[data-ai-id^="{kind}:open:"]').first
        if not link.count():
            pytest.skip(f"{kind}: 项目里没有对象，无法核对详情属性")

        name = (link.get_attribute("data-ai-id") or "").split(":")[-1]
        page.goto(f"{root}/{kind}/{name}")
        surface = ui.detail_surface(kind)
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)

        labels = [text.strip() for text in surface.locator("dt").all_inner_texts()]
        seen[kind] = labels
        for label in expected:
            assert label in labels, (kind, label, labels)

    screenshot(page, "workload-detail-fields")
