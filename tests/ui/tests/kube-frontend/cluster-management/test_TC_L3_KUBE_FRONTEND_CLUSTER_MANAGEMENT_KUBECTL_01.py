from __future__ import annotations

from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_KUBECTL_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01 当前账号工具终端。"""
    ui = cluster_management_page
    ui.open("kubectl")
    expect(ui.kubectl_control("terminal")).to_have_count(0)
    ui.kubectl_control("prepare").click()
    terminal = ui.kubectl_control("terminal")
    expect(terminal).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    marker = f"kubectl-check-{uuid4().hex[:8]}"
    # Split the marker so the echoed command cannot satisfy the output assertion.
    prefix, suffix = marker[:14], marker[14:]
    field = ui.kubectl_control("terminal-output").locator(".xterm-helper-textarea")
    field.press_sequentially(f"printf '%s%s\\n' '{prefix}' '{suffix}'; kubectl version --client -o json")
    field.press("Enter")
    expect(ui.kubectl_control("terminal-output")).to_contain_text(marker, timeout=30_000)
    expect(ui.kubectl_control("terminal-output")).to_contain_text('"gitVersion"', timeout=30_000)
    for width in (1024, 1280, 1600):
        output = ui.kubectl_control("terminal-output")
        previous_columns = output.get_attribute("data-terminal-columns")
        ui.page.set_viewport_size({"width": width, "height": 900})
        expect(output).not_to_have_attribute("data-terminal-columns", previous_columns)
        columns = output.get_attribute("data-terminal-columns")
        rows = output.get_attribute("data-terminal-rows")
        field.press_sequentially("stty size")
        field.press("Enter")
        expect(output).to_contain_text(f"{rows} {columns}", timeout=10_000)
        bounds = ui.page.get_by_role("dialog").bounding_box()
        assert bounds and bounds["width"] >= width - 20 and bounds["height"] >= 880, bounds
        screenshot(ui.page, f"kubectl-{width}")
    ui.kubectl_control("terminal-close").click()
    expect(terminal).to_have_count(0)
    ui.page.goto(ui.url("nodes"))
    ui.open("kubectl")
    expect(ui.kubectl_control("prepare")).to_be_visible()
    expect(ui.kubectl_control("terminal")).to_have_count(0)
