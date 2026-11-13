from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

LOGGING = "/apis/logging.kubesphere.io/v1alpha2"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_LOG_COLLECTIONS_01(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01 集群日志收集。"""

    ui = cluster_management_page
    assert ui.api is not None

    status, collectors = ui.api.request("GET", f"{LOGGING}/fluentbits")
    if status != 200 or not isinstance(collectors, dict):
        pytest.skip("集群没有日志收集 CR（logging API 不可用）")
    collector_items = collectors.get("items") or []
    if not collector_items:
        pytest.skip("集群没有部署日志收集器")

    status, inputs = ui.api.request("GET", f"{LOGGING}/inputs")
    input_items = (inputs.get("items") or []) if status == 200 and isinstance(inputs, dict) else []
    status, outputs = ui.api.request("GET", f"{LOGGING}/outputs")
    output_items = (outputs.get("items") or []) if status == 200 and isinstance(outputs, dict) else []

    namespace = collector_items[0]["metadata"]["namespace"]
    status, pods = ui.api.request(
        "GET", f"/api/v1/namespaces/{namespace}/pods?labelSelector=app.kubernetes.io/name%3Dfluent-bit"
    )
    pod_items = (pods.get("items") or []) if status == 200 and isinstance(pods, dict) else []
    running = [p for p in pod_items if (p.get("status") or {}).get("phase") == "Running"]

    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/log-collections")
    surface = ui.page.locator('[data-ai-id="cluster-log-collections:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

    collector_rows = ui.page.locator('[data-ai-id="cluster-log-collections:collector-list"] [data-ai-row]')
    expect(collector_rows).to_have_count(len(collector_items), timeout=20_000)

    # The collector's own status is empty on this cluster, so health is the pod count —
    # a badge that reads 2/2 is the only trustworthy signal here.
    if pod_items:
        expect(ui.page.locator('[data-ai-id="cluster-log-collections:collectors"]')).to_contain_text(
            f"{len(running)}/{len(pod_items)}", timeout=20_000
        )

    if input_items:
        expect(ui.page.locator('[data-ai-id="cluster-log-collections:input-list"] [data-ai-row]')).to_have_count(
            len(input_items), timeout=20_000
        )
    if output_items:
        expect(ui.page.locator('[data-ai-id="cluster-log-collections:output-list"] [data-ai-row]')).to_have_count(
            len(output_items), timeout=20_000
        )

    screenshot(ui.page, "cluster-log-collections")
