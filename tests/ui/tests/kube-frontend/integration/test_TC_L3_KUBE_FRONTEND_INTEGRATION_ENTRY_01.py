"""同源集成：老控制台顶部入口。"""

from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: The product entries, in the order the header renders them.
ENTRIES = ("工作台", "新版控制台", "智能体工坊", "模型与数据", "生态广场")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_INTEGRATION_ENTRY_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01 入口存在、对齐，点击整页跳转。"""

    origin = ui_config.app.rstrip("/")
    page.goto(f"{origin}/dashboard")
    # The old console renders CSS-module class names, so wait on the entry itself
    # rather than a `.header` selector that does not exist in the markup.
    entry = page.get_by_role("button", name="新版控制台", exact=True).first
    entry.wait_for(state="visible", timeout=60_000)

    # 1. The entry is present and in the documented position.
    for label in ENTRIES:
        expect(page.get_by_role("button", name=label, exact=True).first).to_be_visible(timeout=20_000)

    # 2. Geometry: same row, same height, same gap as its neighbours. Measured
    #    rather than eyeballed — a squeezed flex item still "renders".
    boxes = {}
    for label in ENTRIES:
        box = page.get_by_role("button", name=label, exact=True).first.bounding_box()
        assert box is not None, label
        boxes[label] = box

    heights = {round(box["height"]) for box in boxes.values()}
    tops = {round(box["y"]) for box in boxes.values()}
    assert len(heights) == 1, heights
    assert len(tops) == 1, tops

    gaps = [
        round(boxes[later]["x"] - (boxes[earlier]["x"] + boxes[earlier]["width"]))
        for earlier, later in zip(ENTRIES, ENTRIES[1:])
    ]
    assert len(set(gaps)) == 1, gaps

    screenshot(page, "integration-entry")

    # 3. Clicking navigates as a document load into the new console.
    page.get_by_role("button", name="新版控制台", exact=True).first.click()
    page.wait_for_url("**/kube-frontend/**", timeout=60_000)
    expect(page.locator('[data-ai-id="workbench:surface"]')).to_be_visible(timeout=60_000)
    # No second login: the new console's login form must not appear.
    assert page.locator('[data-ai-id="login:surface"]').count() == 0

    screenshot(page, "integration-entry-landing")
