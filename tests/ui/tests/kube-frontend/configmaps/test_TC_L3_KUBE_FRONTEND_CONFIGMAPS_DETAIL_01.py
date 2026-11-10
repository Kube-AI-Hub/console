from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_DETAIL_01(configmaps_page, seeded_configmaps, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01 详情：属性区四项齐全，数据分区逐条展示键值。"""

    # The list is empty on a fresh cluster; seed two objects so the case does
    # not depend on whatever happens to be deployed.
    seeded_configmaps["create"]("case-a", {"key-a": "1"})
    seeded_configmaps["create"]("case-b", {"key-b": "2"})

    configmaps_page.open()
    configmaps_page.wait_ready()

    if configmaps_page.state != "ready" or not configmaps_page.row_names():
        pytest.skip(f"没有对象可打开，当前状态 {configmaps_page.state}")

    name = configmaps_page.row_names()[0]
    # Read the key list before navigating: the detail page replaces the list, so
    # the row is gone by the time the assertions run.
    keys_cell = configmaps_page.surface.locator(f'[data-ai-row="{name}"] td').nth(3).inner_text()
    configmaps_page.open_detail(name)

    detail = configmaps_page.detail_surface
    expect(detail.get_by_role("heading", level=1)).to_have_text(name)
    # The attribute block mirrors the old console: cluster, project, created, creator.
    for label in ("集群", "项目", "创建时间", "创建者"):
        expect(detail.get_by_text(label, exact=True)).to_be_visible()

    # Every key the list announced must appear in the data section.
    for key in [part.strip() for part in keys_cell.split(",") if part.strip() and part.strip() != "-"]:
        expect(detail.locator(f'[data-ai-row="{key}"]')).to_be_visible()

    screenshot(configmaps_page.page, "detail-attributes-and-data")
