from __future__ import annotations

import time
import re
from uuid import uuid4

import pytest
from playwright.sync_api import expect

from helpers.reads import ReadError

pytestmark = pytest.mark.ui

LOGS = "/kapis/tenant.kubesphere.io/v1alpha2/logs"
SYSTEM_NAMESPACE = "kubesphere-system"


def _stable_pod(api, start: int, end: int):
    """A pod that both exists now and has recent container logs.

    StatefulSet pods (<name>-0) are preferred: they keep their name across restarts, while a
    Deployment's pods are replaced mid-test and the page then 404s for a reason unrelated to
    the feature under test.
    """
    status, body = api.request("GET", f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods?limit=100")
    if status != 200:
        # A failed read is not an absence: fail loudly instead of letting the caller skip.
        raise ReadError(f"APP_WORKLOADS_CONTAINER_DETAIL_02 读取失败：HTTP {status} — {repr(body)[:300]}")
    if not isinstance(body, dict):
        return None
    candidates = []
    for item in body.get("items") or []:
        pod = item["metadata"]["name"]
        for entry in ((item.get("spec") or {}).get("containers") or []):
            candidates.append((pod, str(entry.get("name") or "")))
    candidates.sort(key=lambda pair: (not pair[0].endswith("-0"), pair[0]))
    for pod, container in candidates:
        status, logs = api.request(
            "GET",
            f"{LOGS}?start_time={start}&end_time={end}&size=1"
            f"&namespaces={SYSTEM_NAMESPACE}&pods={pod}&containers={container}",
        )
        if status != 200 or not isinstance(logs, dict):
            continue
        total = int(((logs.get("query") or {}).get("total")) or 0)
        if total <= 0:
            continue
        status, _ = api.request("GET", f"/api/v1/namespaces/{SYSTEM_NAMESPACE}/pods/{pod}")
        if status == 200:
            return pod, container
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_CONTAINER_DETAIL_02(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-02 容器详情：日志。"""

    ui = app_workloads_page
    assert ui.api is not None

    end = int(time.time())
    start = end - 3600
    target = _stable_pod(ui.api, start, end)
    if target is None:
        pytest.skip("没有既存在又有日志的容器可用于验证")
    pod_name, container = target

    # `ui.base` already carries the fixture's workspace/project, so the origin is what is needed.
    origin = ui.base.split("/kube-frontend/")[0]
    ui.page.goto(
        f"{origin}/kube-frontend/system-workspace/clusters/{ui.cluster}"
        f"/projects/{SYSTEM_NAMESPACE}/pods/{pod_name}/containers/{container}"
    )
    surface = ui.page.locator('[data-ai-id="container-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    block = ui.page.locator('[data-ai-id="container-detail:logs"]')
    expect(block).to_be_visible(timeout=30_000)
    ui.page.locator('[data-ai-id="container-detail:logs-open"]').click()
    expect(ui.page.get_by_role("dialog")).to_be_visible()
    output = ui.page.locator('[data-ai-id="container-detail:log-list"] .xterm-rows')
    expect(output).to_have_text(re.compile(r"\S"), timeout=90_000)
    keyword = ui.page.locator('[data-ai-id="container-detail:log-keyword"]')
    keyword.fill(f"no-log-match-{uuid4().hex}")
    ui.page.get_by_role("dialog").get_by_role("button", name="搜索", exact=True).click()
    expect(ui.page.get_by_role("dialog")).to_contain_text("当前条件下没有日志。", timeout=30_000)
    keyword.fill("")
    ui.page.get_by_role("dialog").get_by_role("button", name="搜索", exact=True).click()
    expect(output).to_have_text(re.compile(r"\S"), timeout=30_000)

    screenshot(ui.page, "container-logs")
