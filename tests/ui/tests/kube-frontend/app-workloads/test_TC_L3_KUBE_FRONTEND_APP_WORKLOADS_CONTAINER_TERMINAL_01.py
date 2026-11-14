from __future__ import annotations

import time

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
SYSTEM_WORKSPACE = "system-workspace"

#: Images known to ship a POSIX shell, tried first.
#:
#: The test must not assume one specific pod exists (a Deployment pod is replaced
#: on every redeploy), but trying the system components first keeps the common
#: run to a single page load instead of walking every container in the namespace.
PREFERRED_POD_PREFIXES = (
    "ks-console",
    "ks-apiserver",
    "tower",
    "ks-controller-manager",
    "ks-minio",
    "juicefs-metadb",
)

#: How long one candidate may stay between "connecting" and ready/error.
TERMINAL_SETTLE_SECONDS = 45


def _candidates(api) -> list[tuple[str, str]]:
    """Running (pod, container) pairs in kubesphere-system, most promising first."""
    status, body = api.request("GET", f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods?limit=200")
    if status != 200 or not isinstance(body, dict):
        return []

    pairs: list[tuple[str, str]] = []
    for item in body.get("items") or []:
        if (item.get("status") or {}).get("phase") != "Running":
            continue
        pod = str((item.get("metadata") or {}).get("name") or "")
        if not pod:
            continue
        for entry in (item.get("spec") or {}).get("containers") or []:
            container = str(entry.get("name") or "")
            if container:
                pairs.append((pod, container))

    def rank(pair: tuple[str, str]) -> tuple[int, int, str]:
        for index, prefix in enumerate(PREFERRED_POD_PREFIXES):
            if pair[0].startswith(prefix):
                return (0, index, pair[0])
        return (1, 0, pair[0])

    return sorted(dict.fromkeys(pairs), key=rank)


def _close_terminal(page) -> None:
    """Close the panel if it is open; used between probe candidates."""
    close = page.locator('[data-ai-id="container-detail:terminal-close"]')
    try:
        if close.count() > 0 and close.first.is_visible():
            close.first.click()
            expect(page.locator('[data-ai-id="container-detail:terminal"]')).to_have_count(0, timeout=10_000)
    except Exception:  # noqa: BLE001 - navigation is the next candidate anyway
        pass


def _open_terminal(ui, pod: str, container: str) -> str:
    """Open one container's terminal panel; return its settled state.

    Returned values: ready, error, missing (the container is not on the pod object
    any more) or timeout.
    """
    origin = ui.base.split("/kube-frontend/")[0]
    ui.page.goto(
        f"{origin}/kube-frontend/{SYSTEM_WORKSPACE}/clusters/{ui.cluster}"
        f"/projects/{SYSTEM_NAMESPACE}/pods/{pod}/containers/{container}"
    )
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)
    if ui.page.locator('[data-ai-id="container-detail:missing"]').count() > 0:
        return "missing"

    button = ui.page.locator('[data-ai-id="container-detail:terminal-open"]')
    expect(button).to_be_visible(timeout=20_000)
    button.click()

    panel = ui.page.locator('[data-ai-id="container-detail:terminal"]')
    expect(panel).to_be_visible(timeout=20_000)
    deadline = time.time() + TERMINAL_SETTLE_SECONDS
    while time.time() < deadline:
        state = panel.get_attribute("data-ai-state")
        if state in ("ready", "error"):
            return state
        if panel.count() == 0:
            # Navigating away or closing unmounts the panel; treat it as a timeout
            # rather than reading a detached attribute.
            return "timeout"
        time.sleep(0.25)
    return "timeout"


def _terminal_error_text(page) -> str:
    error = page.locator('[data-ai-id="container-detail:terminal-error"]')
    if error.count() == 0:
        return ""
    return error.inner_text(timeout=10_000)


def _looks_like_missing_shell(text: str) -> bool:
    """Upstream wording when the container has no /bin/sh."""
    lowered = text.lower()
    return "no such file" in lowered or "stat /bin/sh" in lowered or "executable file not found" in lowered


def _wait_for_exact_line(output, expected: str, timeout: float = 20.0) -> bool:
    """Wait until the output area has a line whose text is exactly the expected one.

    The pty echoes the typed command back, so a plain contain-text check would pass
    on the echoed line before the command has run. The command's own output is a
    separate line, which is what this case is about.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        rows = [text.strip() for text in output.locator("[data-ai-row]").all_inner_texts()]
        if expected in rows:
            return True
        time.sleep(0.2)
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_TERMINAL_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_TERMINAL-01 容器详情：终端 exec 通道。"""

    ui = app_workloads_page
    assert ui.api is not None

    candidates = _candidates(ui.api)
    if not candidates:
        pytest.skip("kubesphere-system 里没有运行中的容器，无法探测可 exec 的 shell")

    target: tuple[str, str] | None = None
    no_shell: tuple[str, str] | None = None
    for pod, container in candidates:
        state = _open_terminal(ui, pod, container)
        if state == "missing":
            # The pod was replaced between the list call and the navigation.
            continue
        if state == "ready":
            target = (pod, container)
            break
        if state == "timeout":
            _close_terminal(ui.page)
            raise AssertionError(
                f"终端面板 45 秒内没有进入 ready 或 error（{pod}/{container}）——"
                "看 BFF upgrade 转发与静态服务器的 Upgrade 透传是否生效"
            )

        error_text = _terminal_error_text(ui.page)
        if _looks_like_missing_shell(error_text):
            # The channel works; this container just has no /bin/sh. Keep it as the
            # error-path witness and try the next candidate.
            no_shell = (pod, container)
            _close_terminal(ui.page)
            continue
        if "not found" in error_text.lower():
            _close_terminal(ui.page)
            continue
        raise AssertionError(f"终端通道连接失败（{pod}/{container}）：{error_text or '没有错误文本'}")

    if target is None:
        if no_shell is not None:
            pytest.skip(
                "探测到的容器都没有 /bin/sh（例如 "
                f"{no_shell[0]}/{no_shell[1]}），无法验证能输入命令的终端；"
                "这是容器镜像的限制，不是页面缺陷"
            )
        pytest.skip("没有找到可用于验证终端的容器")

    pod, container = target
    output = ui.page.locator('[data-ai-id="container-detail:terminal-output"]')
    expect(output).to_be_visible(timeout=10_000)

    field = ui.page.locator('[data-ai-id="container-detail:terminal-input"]')
    expect(field).to_be_enabled(timeout=15_000)
    field.fill("echo tc-terminal-ok")
    field.press("Enter")

    expect(output).to_contain_text("tc-terminal-ok", timeout=20_000)
    assert _wait_for_exact_line(output, "tc-terminal-ok"), (
        "终端输出里没有一行恰好是 tc-terminal-ok（输入回显不算）；"
        f"当前行：{[text.strip() for text in output.locator('[data-ai-row]').all_inner_texts()][-5:]}"
    )
    screenshot(ui.page, "container-terminal")

    ui.page.locator('[data-ai-id="container-detail:terminal-close"]').click()
    expect(ui.page.locator('[data-ai-id="container-detail:terminal"]')).to_have_count(0, timeout=10_000)
    expect(ui.page.locator('[data-ai-id="container-detail:terminal-open"]')).to_be_visible(timeout=10_000)

    # A container without a shell must explain itself instead of staying blank.
    if no_shell is not None:
        state = _open_terminal(ui, *no_shell)
        assert state == "error", f"没有 /bin/sh 的容器应进入 error 状态，实际为 {state}"
        error_text = _terminal_error_text(ui.page)
        assert error_text.strip(), "没有 /bin/sh 时错误区为空"
        assert _looks_like_missing_shell(error_text), f"错误区没有上游原因：{error_text[:300]}"
        screenshot(ui.page, "container-terminal-no-shell")
        _close_terminal(ui.page)
