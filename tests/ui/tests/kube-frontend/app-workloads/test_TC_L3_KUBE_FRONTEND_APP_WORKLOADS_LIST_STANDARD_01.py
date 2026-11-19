from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

# The cluster-wide list, not the project one: it keeps six columns at every width
# (project, status, ready, images, created), so a laptop viewport really overflows.
# The project list folds its trailing columns below `xl` by design, which leaves
# nothing to scroll — a pin cannot be observed on a table that fits.
SURFACE = '[data-ai-id="cluster-deployments:surface"]'


def _open(ui, width: int = 900) -> None:
    ui.page.set_viewport_size({"width": width, "height": 900})
    origin = ui.base.split("/kube-frontend/")[0]
    ui.page.goto(f"{origin}/kube-frontend/clusters/{ui.cluster}/deployments")
    surface = ui.page.locator(SURFACE).last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=90_000)
    expect(surface.locator("[data-ai-row]").first).to_be_visible(timeout=30_000)


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_LIST_STANDARD_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01 固定首尾列与刷新可见。"""

    ui = app_workloads_page
    _open(ui, width=900)
    surface = ui.page.locator(SURFACE).last

    box = surface.locator("table").locator("xpath=..")
    metrics = box.evaluate(
        """(el) => {
            // Force an overflow: the real page fits at this width, and a pin cannot be
            // observed on a table that does not scroll. Widening the table is what a
            // narrower window or an extra column does, without depending on either.
            el.querySelector('table').style.minWidth = '1500px';
            const headers = el.querySelectorAll('thead th');
            const nameTh = headers[1];
            const lastTh = headers[headers.length - 1];
            const nameTd = el.querySelector('tbody tr td:nth-child(2)');
            // Two scrolled positions, not "before vs after": at scrollLeft 0 the identity
            // column still sits at its natural place after the pinned checkbox, so the
            // first scroll legitimately moves it to its sticky offset. A pin means it
            // stops moving once it is stuck — that is what must hold.
            el.scrollLeft = 200;
            const first = { x: nameTh.getBoundingClientRect().x, right: lastTh.getBoundingClientRect().right };
            el.scrollLeft = 500;
            return {
                scrollable: el.scrollWidth > el.clientWidth + 4,
                scrolled: el.scrollLeft,
                nameFirst: first.x,
                nameSecond: nameTh.getBoundingClientRect().x,
                rightFirst: first.right,
                rightSecond: lastTh.getBoundingClientRect().right,
                namePin: getComputedStyle(nameTh).position,
                nameBg: getComputedStyle(nameTd).backgroundColor,
                lastPin: getComputedStyle(lastTh).position,
                containerX: el.getBoundingClientRect().x,
                containerRight: el.getBoundingClientRect().right,
            };
        }"""
    )

    # The table must actually overflow, or the assertion proves nothing.
    assert metrics["scrollable"], f"900px 视口下表格没有横向溢出，无法验证固定列：{metrics}"
    assert metrics["scrolled"] > 0, f"表格没有真的滚动：{metrics}"
    assert metrics["namePin"] == "sticky", f"身份列没有固定：{metrics}"
    assert metrics["lastPin"] == "sticky", f"操作列没有固定：{metrics}"
    # A pinned cell must paint an opaque background, otherwise rows scroll through it.
    assert "rgba(0, 0, 0, 0)" not in metrics["nameBg"], f"固定列背景透明：{metrics}"
    # Both edges stay put while the middle columns move under them.
    assert abs(metrics["nameSecond"] - metrics["nameFirst"]) < 2, f"身份列随滚动移动：{metrics}"
    assert abs(metrics["rightSecond"] - metrics["rightFirst"]) < 2, f"操作列随滚动移动：{metrics}"
    assert metrics["nameSecond"] >= metrics["containerX"] - 1, f"身份列滚出了容器：{metrics}"

    rows_before = surface.locator("[data-ai-row]").count()
    ui.page.locator('[data-ai-id="cluster-deployments:refresh"]').click()
    veil = ui.page.locator('[data-ai-id="table:refreshing"]')
    expect(veil).to_be_visible(timeout=10_000)
    assert veil.inner_text().strip() == "更新中…", veil.inner_text()
    busy = surface.locator('[aria-busy="true"]').first
    expect(busy).to_be_visible(timeout=5_000)
    # A refetch keeps the rows: the reader must not lose their place.
    assert surface.locator("[data-ai-row]").count() == rows_before, "刷新时行被替换成骨架"

    expect(veil).to_have_count(0, timeout=60_000)
    assert surface.locator("[data-ai-row]").count() > 0, "刷新后列表为空"
    screenshot(ui.page, "list-standard-pinned-and-refresh")
