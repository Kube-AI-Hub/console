from __future__ import annotations

import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_KUBECTL_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03 Tab 补全、历史和行内编辑。"""
    ui = cluster_management_page
    ui.open("kubectl")
    ui.kubectl_control("prepare").click()
    expect(ui.kubectl_control("terminal")).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    output = ui.kubectl_control("terminal-output")
    field = output.locator(".xterm-helper-textarea")
    rows = output.locator(".xterm-rows > div")
    # The shell, not the browser, completes the command name.
    field.press_sequentially("kubect")
    field.press("Tab")
    expect(field).to_be_focused()
    field.press_sequentially(" version --client -o json")
    field.press("Enter")
    expect(output).to_contain_text('"gitVersion"', timeout=15_000)
    # A completed path must be command output, not just input echo.
    field.press_sequentially("printf '%s\\n' /bi")
    field.press("Tab")
    expect(field).to_be_focused()
    field.press("Enter")
    bin_rows = rows.filter(has_text=re.compile(r"^/bin/$"))
    expect(bin_rows).to_have_count(1, timeout=10_000)
    field.press("ArrowUp")
    field.press("Enter")
    expect(bin_rows).to_have_count(2, timeout=10_000)
    # Ctrl+U clears the draft; Ctrl+A/E edit the line without shifting DOM focus.
    field.press_sequentially("draft-that-must-not-run")
    field.press("Control+u")
    marker = f"line-{uuid4().hex[:8]}"
    field.press_sequentially(f" '%s%s\\n' '{marker[:5]}' '{marker[5:]}'")
    field.press("Control+a")
    field.press_sequentially("printf")
    field.press("Control+e")
    field.press("Enter")
    expect(rows.filter(has_text=re.compile(f"^{marker}$"))).to_have_count(1, timeout=10_000)
    expect(field).to_be_focused()
    screenshot(ui.page, "kubectl-tab-completion")
    ui.kubectl_control("terminal-close").click()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
