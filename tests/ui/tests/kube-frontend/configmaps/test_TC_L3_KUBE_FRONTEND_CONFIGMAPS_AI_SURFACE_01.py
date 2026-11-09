from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_AI_SURFACE_01(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01 状态可读：data-ai-state 取值在四态之内。"""

    configmaps_page.open()
    configmaps_page.wait_ready()

    assert configmaps_page.state in {"loading", "ready", "empty", "error"}, configmaps_page.state
    after = configmaps_page.state
    assert after in {"ready", "empty", "error"}, after
