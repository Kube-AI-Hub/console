from __future__ import annotations

import urllib.error
import urllib.request

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

SYSTEM_NAMESPACE = "kubesphere-system"
SYSTEM_WORKSPACE = "system-workspace"

#: The live tail only starts when the container's current log is big enough for
#: the upstream to flush its response headers (see the design doc's known
#: pitfall: ks-apiserver v3.4.1 buffers ~4 KB before sending anything). Probe that
#: condition instead of assuming it — a quiet container would leave the page on
#: "connecting" for a reason unrelated to the page under test.
MIN_LOG_BYTES = 4096


def _log_request(api, path: str) -> urllib.request.Request:
    return urllib.request.Request(
        f"{api.base}{path}",
        headers={"Authorization": f"Bearer {api.token}", "Accept": "*/*"},
    )


def _static_log_bytes(api, pod: str, container: str) -> int:
    """Size of the current log file, read the non-follow way (always answers)."""
    path = (
        f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods/{pod}/log"
        f"?container={container}&tailLines=2000"
    )
    try:
        with urllib.request.urlopen(_log_request(api, path), timeout=20) as response:
            return len(response.read())
    except (OSError, urllib.error.URLError):
        return 0


def _follow_starts(api, pod: str, container: str) -> bool:
    """Whether a follow request reaches a 200 and a first line within a few seconds."""
    path = (
        f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods/{pod}/log"
        f"?container={container}&follow=true&timestamps=true"
    )
    try:
        with urllib.request.urlopen(_log_request(api, path), timeout=3) as response:
            return response.status == 200 and bool(response.read(1))
    except (OSError, urllib.error.URLError):
        return False


def _followable_container(api):
    """A (pod, container) the live tail can actually start on, or None."""
    status, body = api.request("GET", f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods?limit=100")
    if status != 200 or not isinstance(body, dict):
        return None

    candidates: list[tuple[str, str]] = []
    for item in body.get("items") or []:
        pod = item["metadata"]["name"]
        for entry in (item.get("spec") or {}).get("containers") or []:
            candidates.append((pod, str(entry.get("name") or "")))
    # StatefulSet pods keep their name across restarts; a Deployment's pod can be
    # replaced mid-test and then the page 404s for an unrelated reason.
    candidates.sort(key=lambda pair: (not pair[0].endswith("-0"), pair[0]))

    for pod, container in candidates:
        if _static_log_bytes(api, pod, container) < MIN_LOG_BYTES:
            continue
        if _follow_starts(api, pod, container):
            return pod, container
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_03(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-03 容器详情：实时日志 tail。"""

    ui = app_workloads_page
    assert ui.api is not None

    target = _followable_container(ui.api)
    if target is None:
        pytest.skip("没有「当前日志足够大、follow 会立即开始」的容器可用于验证实时日志")
    pod, container = target

    origin = ui.base.split("/kube-frontend/")[0]
    ui.page.goto(
        f"{origin}/kube-frontend/{SYSTEM_WORKSPACE}/clusters/{ui.cluster}"
        f"/projects/{SYSTEM_NAMESPACE}/pods/{pod}/containers/{container}"
    )
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    logs = ui.page.locator('[data-ai-id="container-detail:logs"]')
    expect(logs).to_be_visible(timeout=30_000)
    # Search is the default view: the live list does not exist until asked for.
    expect(ui.page.locator('[data-ai-id="container-detail:log-stream"]')).to_have_count(0)
    expect(ui.page.locator('[data-ai-id="container-detail:log-keyword"]')).to_be_visible(timeout=20_000)

    switch = ui.page.locator('[data-ai-id="container-detail:log-follow"] [role="switch"]')
    expect(switch).to_be_visible(timeout=20_000)
    expect(switch).to_have_attribute("aria-checked", "false")
    switch.click()

    stream = ui.page.locator('[data-ai-id="container-detail:log-stream"]')
    expect(stream).to_be_visible(timeout=20_000)
    expect(stream).to_have_attribute("data-ai-state", "ready", timeout=90_000)

    rows = ui.page.locator('[data-ai-id="container-detail:log-stream"] [data-ai-row]')
    expect(rows.first).to_be_visible(timeout=90_000)
    assert rows.count() >= 1, "实时流没有渲染出任何日志行"
    # The page keeps the newest 1000 lines; more than that is a retention bug.
    assert rows.count() <= 1000, f"实时流保留了 {rows.count()} 行，超过 1000 行上限"

    stop = ui.page.locator('[data-ai-id="container-detail:log-stream-stop"]')
    expect(stop).to_be_visible(timeout=10_000)
    stop.click()

    expect(switch).to_have_attribute("aria-checked", "false", timeout=10_000)
    expect(ui.page.locator('[data-ai-id="container-detail:log-stream"]')).to_have_count(0, timeout=10_000)
    # Search mode comes back, including its keyword box: the pre-live contract.
    expect(ui.page.locator('[data-ai-id="container-detail:log-keyword"]')).to_be_visible(timeout=20_000)

    # Stopping must not wedge the channel: a second session starts again.
    switch.click()
    expect(ui.page.locator('[data-ai-id="container-detail:log-stream"]')).to_be_visible(timeout=20_000)
    expect(
        ui.page.locator('[data-ai-id="container-detail:log-stream"] [data-ai-row]').first
    ).to_be_visible(timeout=90_000)

    screenshot(ui.page, "container-log-follow")
