from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

LOGGING = "/apis/logging.kubesphere.io/v1alpha2"
CLASSES = {"logging": "容器日志", "events": "事件", "auditing": "审计"}


def _class_of(item: dict) -> str:
    """The class the logging operator labelled the object with, defaulting like the page."""
    labels = (item.get("metadata") or {}).get("labels") or {}
    component = labels.get("logging.kubesphere.io/component") or ""
    return component if component in CLASSES else "logging"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_LOG_COLLECTIONS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02 日志收集三页签与只读详情。"""

    ui = cluster_management_page
    assert ui.api is not None, "api client required"

    status, body = ui.api.request("GET", f"{LOGGING}/outputs")
    if status != 200 or not isinstance(body, dict):
        pytest.skip("logging outputs 不可用")
    items = body.get("items") or []
    expected: dict[str, int] = {name: 0 for name in CLASSES}
    for item in items:
        expected[_class_of(item)] += 1

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/log-collections")
    surface = ui.page.locator('[data-ai-id="cluster-log-collections:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    # Three tabs, visible whether or not a class has objects.
    for name, label in CLASSES.items():
        tab = ui.page.locator(f'[data-ai-id="cluster-log-collections:tab:{name}"]')
        expect(tab).to_be_visible()
        assert label in tab.inner_text(), tab.inner_text()

    # Each tab renders its own collection table and source table.
    for name, label in CLASSES.items():
        ui.page.locator(f'[data-ai-id="cluster-log-collections:tab:{name}"]').click()
        panel = ui.page.locator(f'[data-ai-id="cluster-log-collections:panel:{name}"]')
        expect(panel).to_be_visible(timeout=20_000)
        text = panel.inner_text()
        assert "收集项" in text and "名称" in text, text[:200]
        assert "采集输入" in text, text[:300]
        if expected[name] == 0:
            assert "该分类没有收集项" in text, text[:200]
        else:
            rows = ui.page.locator('[data-ai-id="cluster-log-collections:output-list"] [data-ai-row]:visible')
            expect(rows).to_have_count(expected[name], timeout=20_000)

    ui.page.locator('[data-ai-id="cluster-log-collections:tab:logging"]').click()
    screenshot(ui.page, "log-collections-tabs")

    # Detail is read-only: attributes, match/filter summary, and the raw YAML as text.
    class_with_rows = next((name for name in CLASSES if expected[name] > 0), None)
    if class_with_rows is None:
        pytest.skip("集群没有任何日志接收器，无从打开详情")
    ui.page.locator(f'[data-ai-id="cluster-log-collections:tab:{class_with_rows}"]').click()
    row = ui.page.locator('[data-ai-id="cluster-log-collections:output-list"] [data-ai-row]:visible').first
    name = row.get_attribute("data-ai-row") or ""
    assert name, "collection row has no name"
    row.locator("button").first.click()

    detail = ui.page.locator('[data-ai-id="cluster-log-collections:detail"]')
    expect(detail).to_be_visible(timeout=20_000)
    assert name in detail.inner_text()
    assert "匹配与过滤" in detail.inner_text()

    yaml_box = ui.page.locator('[data-ai-id="cluster-log-collections:yaml"]')
    expect(yaml_box).to_be_visible()
    yaml_text = yaml_box.inner_text()
    assert "apiVersion: logging.kubesphere.io/v1alpha2" in yaml_text, yaml_text[:200]
    assert "kind: Output" in yaml_text, yaml_text[:200]
    # Read-only by construction: no editor inside the YAML block.
    assert yaml_box.locator("textarea, [contenteditable]").count() == 0

    dialog = ui.page.locator('[role="dialog"]').first
    action_labels = dialog.locator("button").all_inner_texts()
    for forbidden in ("保存", "创建", "删除", "应用", "提交"):
        assert not any(forbidden in label for label in action_labels), (forbidden, action_labels)

    screenshot(ui.page, "log-collections-detail")
    ui.page.locator('[data-ai-id="cluster-log-collections:detail-close"]').click()
    expect(detail).not_to_be_visible(timeout=10_000)
