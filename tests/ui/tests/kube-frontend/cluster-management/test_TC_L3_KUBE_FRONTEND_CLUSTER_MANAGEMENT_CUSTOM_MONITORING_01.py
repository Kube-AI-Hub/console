from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CUSTOM_MONITORING_01(page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_MONITORING-01 自定义监控仪表板。"""

    cluster = ui_config.cluster
    page.goto(f"{ui_config.app}/kube-frontend/clusters/{cluster}/custom-monitoring")
    surface = page.locator('[data-ai-id="custom-monitoring:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    page.wait_for_function(
        """() => {
            const el = document.querySelector('[data-ai-id="custom-monitoring:surface"]');
            return el && el.getAttribute('data-ai-state') !== 'loading';
        }""",
        timeout=60_000,
    )

    state = surface.get_attribute("data-ai-state")
    assert state in ("ready", "empty"), f"自定义监控页进入了 {state} 状态"

    # The page must say the panel editor is missing: a reader who sees no charts has to know
    # whether they are broken or simply not migrated.
    expect(page.locator('[data-ai-id="custom-monitoring:panel-note"]')).to_be_visible()

    if state == "empty":
        screenshot(page, "custom-monitoring-empty")
        return

    rows = page.locator('[data-ai-id="custom-monitoring:surface"] [data-ai-row]')
    assert rows.count() > 0

    # 行操作收在「更多操作」菜单里：先展开菜单，再点菜单项。
    rows.first.locator('button[aria-label="更多操作"]').click()
    page.get_by_role("menuitem", name="查看 YAML", exact=True).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=15_000)
    # The YAML lives in a CodeMirror editor, not in the dialog's text nodes — read the editor
    # element, not innerText, or the assertion passes on the title alone.
    editor = dialog.locator(".cm-editor")
    expect(editor).to_be_visible()
    content = dialog.locator(".cm-content").inner_text()
    assert "panels" in content or "apiVersion" in content, content[:200]
    page.keyboard.press("Escape")
    screenshot(page, "custom-monitoring")
