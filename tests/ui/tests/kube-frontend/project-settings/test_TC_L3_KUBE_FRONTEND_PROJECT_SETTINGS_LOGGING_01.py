from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

LABEL = "logging.kubesphere.io/logsidecar-injection"
NAMESPACE = "/api/v1/namespaces/default"
KAPIS_NAMESPACE = "/kapis/resources.kubesphere.io/v1alpha3/namespaces/default"


def _label(api) -> str | None:
    status, body = api.request("GET", KAPIS_NAMESPACE)
    if status != 200 or not isinstance(body, dict):
        return None
    return ((body.get("metadata") or {}).get("labels") or {}).get(LABEL)


def _set_label(api, value: str | None) -> int:
    status, _ = api.request(
        "PATCH",
        NAMESPACE,
        {"metadata": {"labels": {LABEL: value}}},
        "application/merge-patch+json",
    )
    return status


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_LOGGING_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01 日志收集：三态与开关写入标签。"""

    ui = project_settings_page
    assert ui.api is not None

    original = _label(ui.api)
    if original is None:
        # Start from "never configured" so the three states can all be observed.
        _set_label(ui.api, None)
    panel = ui.page.locator('[data-ai-id="log-collection:panel"]')
    toggle = ui.page.locator('[data-ai-id="log-collection:toggle"]')

    try:
        ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/logging")
        surface = ui.page.locator('[data-ai-id="log-collection:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # ---- US3: "never configured" and "disabled" are different facts ----
        if original is None:
            assert "未配置" in panel.inner_text(), panel.inner_text()[:200]

        # ---- US1: enabling writes the label, not just the page ----
        toggle.click()
        deadline = 30_000
        expect(panel).to_contain_text("已开启", timeout=deadline)
        assert _label(ui.api) == "enabled", (
            "开启后标签不是 enabled：写成了 annotation，或请求没发出去"
        )

        # ---- US2: disabling asks first, and cancelling changes nothing ----
        toggle.click()
        confirm = ui.page.locator('[data-ai-id="log-collection:confirm"]')
        expect(confirm).to_be_visible(timeout=20_000)
        assert "重启" in confirm.inner_text(), f"确认文案应说明容器组会重启: {confirm.inner_text()}"
        ui.page.locator('[data-ai-id="log-collection:cancel-disable"]').click()
        ui.page.wait_for_timeout(800)
        assert _label(ui.api) == "enabled", "取消后标签被改动"

        toggle.click()
        expect(confirm).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="log-collection:confirm-disable"]').click()
        expect(panel).to_contain_text("已关闭", timeout=30_000)
        assert _label(ui.api) == "disabled", "确认关闭后标签不是 disabled"

        screenshot(ui.page, "project-log-collection")
    finally:
        # The label belongs to the cluster, not to this test run.
        _set_label(ui.api, original)
        assert _label(ui.api) == original
