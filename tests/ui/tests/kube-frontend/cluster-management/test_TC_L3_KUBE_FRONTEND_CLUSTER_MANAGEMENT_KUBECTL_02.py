from __future__ import annotations

import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_KUBECTL_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02 ANSI、光标移动及 vim 备用屏幕。"""
    ui = cluster_management_page
    ui.open("kubectl")
    ui.kubectl_control("prepare").click()
    terminal = ui.kubectl_control("terminal")
    expect(terminal).to_have_attribute("data-ai-state", "ready", timeout=60_000)
    output = ui.kubectl_control("terminal-output")
    field = output.locator(".xterm-helper-textarea")
    marker = f"ansi-{uuid4().hex[:8]}"
    field.press_sequentially(f"printf '\\033[31m%s%s\\033[0m\\n' '{marker[:5]}' '{marker[5:]}'; command -v vim || command -v vi")
    field.press("Enter")
    red = output.locator(".xterm-rows span").filter(has_text=re.compile(f"^{marker}$"))
    expect(red).to_be_visible(timeout=20_000)
    red_color = red.evaluate("(element) => getComputedStyle(element).color")
    default_color = output.locator(".xterm-rows").evaluate("(element) => getComputedStyle(element).color")
    assert red_color != default_color, f"ANSI 颜色未保留: {red_color}"
    # The prompt depends on whether the container provides bash or sh.
    expect(output.locator(".xterm-rows > div").filter(has_text=re.compile(r"^/\S+/(vim|vi)$")).last).to_be_visible(timeout=10_000)
    lines = output.locator(".xterm-rows > div").all_inner_texts()
    editor = next((line.strip() for line in lines if re.fullmatch(r"/\S+/(vim|vi)", line.strip())), None)
    assert editor, f"目标容器没有 vim/vi，无法验证编辑器: {lines}"
    print(f"Verified remote editor: {editor}")
    command = f"{editor} -Nu NONE -n -i NONE" if editor.endswith("/vim") else editor
    field.press_sequentially(command)
    field.press("Enter")
    field.press("i")
    text = f"cursor-{uuid4().hex[:6]}"
    field.press_sequentially(text)
    expect(output).to_contain_text(text, timeout=10_000)
    # Move the remote editor cursor, insert within the text, then leave insert mode.
    field.press("ArrowLeft")
    field.press("ArrowLeft")
    field.press_sequentially("Z")
    expect(output).to_contain_text(text[:-2] + "Z" + text[-2:], timeout=10_000)
    field.press("Escape")
    expect(ui.page.get_by_role("dialog")).to_be_visible()
    screenshot(ui.page, "kubectl-editor")
    field.press_sequentially(":q!")
    field.press("Enter")
    # Alternate-screen exit restores the shell, without writing a file.
    expect(output).to_contain_text(marker, timeout=10_000)
    field.press_sequentially("printf '%s%s\\n' 'after-' 'editor'")
    field.press("Enter")
    expect(output).to_contain_text("after-editor", timeout=10_000)
    field.press_sequentially("sleep 30")
    field.press("Enter")
    expect(output).to_contain_text("sleep 30")
    field.press("Control+c")
    field.press_sequentially("printf '%s%s\\n' 'after-' 'interrupt'")
    field.press("Enter")
    expect(output).to_contain_text("after-interrupt", timeout=5_000)
    ui.kubectl_control("terminal-close").click()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
