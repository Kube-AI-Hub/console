from __future__ import annotations

import pytest

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_SECRETS_AI_SURFACE_01(secrets_page, e2e_objects):
    """TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01 保密字典：状态与句柄契约。"""

    name = e2e_objects["secret"](e2e_objects["unique"](), data={"k": "v"})
    secrets_page.open()

    assert secrets_page.state in {"loading", "ready", "empty", "error"}
    assert secrets_page.state == "ready"
    assert name in secrets_page.row_names()

    bulk = secrets_page.page.locator('[data-ai-id="secrets:bulk-delete"]')
    assert bulk.get_attribute("data-ai-needs") == "secrets:row-select"
    for ai_id in ("secrets:search", "secrets:create"):
        assert secrets_page.page.locator(f'[data-ai-id="{ai_id}"]').count() >= 1, ai_id

    secrets_page.open_detail(name)
    toggle = secrets_page.toggle_values
    assert toggle.get_attribute("aria-pressed") == "false"
    toggle.click()
    assert toggle.get_attribute("aria-pressed") == "true"
