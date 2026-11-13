from __future__ import annotations

from collections import Counter

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

POD_METRICS = "/apis/metrics.k8s.io/v1beta1/pods"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_PROJECTS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-02 项目列表：CPU/内存用量与容器组数。"""

    ui = cluster_management_page
    assert ui.api is not None

    # PERFORMANCE: the cluster-wide pod metrics list takes tens of seconds on this
    # cluster (it scales with pod count). Retry rather than skip on one slow failure —
    # a slow read is the condition this case tolerates, not a reason to report "no data".
    status, body = 0, {}
    for _ in range(3):
        try:
            status, body = ui.api.request("GET", POD_METRICS, timeout=180)
        except Exception:
            status, body = 0, {}
            continue
        if status == 200:
            break
    if status != 200:
        pytest.skip(f"metrics.k8s.io 不可用（{status}），用量列降级")
    items = body.get("items") or [] if isinstance(body, dict) else []
    if not items:
        pytest.skip("没有 Pod 指标可核对")
    counts = Counter(item["metadata"]["namespace"] for item in items if item.get("metadata", {}).get("namespace"))

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/namespaces")
    surface = ui.page.locator('[data-ai-id="namespaces:surface"]')
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    # The usage read is a second query; give it a moment to land.
    ui.page.wait_for_timeout(3000)

    headers = [t.strip() for t in surface.locator("thead th:visible").all_inner_texts()]
    for column in ("CPU 使用率", "内存使用率", "容器组数"):
        assert column in headers, headers

    checked = 0
    for namespace, expected in counts.most_common(5):
        row = surface.locator(f'[data-ai-row="{namespace}"]')
        if row.count() == 0:
            continue
        cells = [cell.strip() for cell in row.locator("td").all_inner_texts()]
        # The pod count column must agree with the metrics API.
        assert str(expected) in cells, (namespace, expected, cells)
        checked += 1
    assert checked > 0, "no project row could be compared"

    # Usage is read from each pod's containers[]. Reading the node shape (top-level
    # `usage`) leaves every project at 0 while the pod count stays right.
    # Read the CPU column by its header position rather than by a styling class: the
    # number lives in a span inside the cell.
    cpu_index = headers.index("CPU 使用率")
    values = [
        row.locator("td").nth(cpu_index).inner_text().strip()
        for row in surface.locator("tbody tr").all()
    ]
    values = [value for value in values if value]
    assert any(value not in ("0", "0.00", "-") for value in values), values[:10]
    screenshot(ui.page, "cluster-project-usage")
