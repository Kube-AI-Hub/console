from __future__ import annotations

import math
import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_03(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03 六类资源与 scheduler 标签对账。"""
    ui = cluster_overview_page
    with ui.page.expect_response(lambda response: "/monitoring.kubesphere.io/v1alpha3/cluster?" in response.url) as cluster_response, \
         ui.page.expect_response(lambda response: "/components/scheduler?" in response.url) as scheduler_response:
        ui.open()
    ui.wait_ready()
    response = cluster_response.value
    assert response.status == 200
    values = {}
    for result in response.json().get("results", []):
        samples = result.get("data", {}).get("result", [])
        if samples:
            value = float(samples[0]["value"][1])
            if math.isfinite(value):
                values[result["metric_name"]] = value
    pairs = {
        "cpu": ("cluster_cpu_usage", "cluster_cpu_total"),
        "memory": ("cluster_memory_usage_wo_cache", "cluster_memory_total"),
        "pods": ("cluster_pod_running_count", "cluster_pod_quota"),
        "gpu": ("cluster_gpu_usage", "cluster_gpu_total"),
        "gpu-memory": ("cluster_gpu_memory_usage", "cluster_gpu_memory_total"),
        "disk": ("cluster_disk_size_usage", "cluster_disk_size_capacity"),
    }
    for key, (used, total) in pairs.items():
        expect(ui.usage_row(key)).to_be_visible(timeout=30_000)
        if used in values and values.get(total, 0) > 0:
            percent = int(values[used] / values[total] * 100 + .5)
            expect(ui.usage_row(key)).to_contain_text(f"{percent}%")
        else:
            expect(ui.usage_row(key).get_by_role("progressbar")).to_have_count(0)
    gpu = ui.usage_text("gpu")
    assert f'{values["cluster_gpu_usage"]:g} 卡' in gpu
    assert f'已分配 {values["cluster_gpu_allocated"]:g} 卡' in gpu
    for key in ("gpu-memory", "disk", "memory"):
        assert "GiB" in ui.usage_text(key) or "TiB" in ui.usage_text(key)
    scheduler = scheduler_response.value
    assert scheduler.status == 200
    labels = {sample["metric"]["result"]: sample["value"][1]
              for result in scheduler.json()["results"]
              for sample in result["data"]["result"]}
    for label, field in (("scheduled", "scheduled"), ("error", "schedule-error"), ("unschedulable", "unschedulable")):
        if label in labels:
            expect(ui.control(field)).to_contain_text(str(int(float(labels[label]))))
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 900})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        screenshot(ui.page, f"overview-complete-{width}")
