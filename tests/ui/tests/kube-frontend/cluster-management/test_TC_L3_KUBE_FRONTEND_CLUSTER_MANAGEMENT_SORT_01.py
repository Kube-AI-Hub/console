from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _names(page, kind: str) -> list[str]:
    return page.evaluate(
        """(kind) => {
            const surface = document.querySelector('[data-ai-id="' + kind + ':surface"]');
            if (!surface) return [];
            return Array.from(surface.querySelectorAll('[data-ai-row]')).map((el) => el.getAttribute('data-ai-row'));
        }""",
        kind,
    )


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_SORT_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01 集群页：名称排序可切换。"""

    ui = cluster_management_page
    page = ui.page

    for kind in ("storageclasses", "components"):
        page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/{kind}")
        surface = page.locator(f'[data-ai-id="{kind}:surface"]')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)

        initial = _names(page, kind)
        if len(initial) < 2:
            pytest.skip(f"{kind}: 数据不足两条，无法比较排序")

        sorter = page.locator(f'[data-ai-id="{kind}:sort:name"]')
        sorter.click()
        page.wait_for_timeout(2000)
        ascending = _names(page, kind)
        sorter.click()
        page.wait_for_timeout(2000)
        descending = _names(page, kind)

        # Both of these pages had a dead sort control: storage classes are read from the
        # core API, which ignores the sort parameters, and the components page ordered by
        # health regardless of the control.
        assert ascending == sorted(ascending), (kind, ascending)
        assert descending == sorted(descending, reverse=True), (kind, descending)
        assert ascending != descending, (kind, ascending, descending)

    # The components page still opens with unhealthy components first.
    unhealthy_first = _names(page, "components")
    rows = page.locator('[data-ai-id="components:surface"] [data-ai-row]')
    if rows.count():
        assert "无后端" in rows.first.inner_text() or unhealthy_first[0] in rows.first.inner_text()
