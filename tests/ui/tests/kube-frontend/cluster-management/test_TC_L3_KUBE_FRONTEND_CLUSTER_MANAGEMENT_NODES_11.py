from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_11(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11 节点资源、健康与 GPU/RDMA 拓扑。"""
    ui = cluster_management_page
    assert ui.api is not None
    name = "gpu02"
    status, node = ui.api.request("GET", f"/kapis/resources.kubesphere.io/v1alpha3/nodes/{name}")
    assert status == 200
    writes = []
    ui.page.on("request", lambda request: writes.append(request) if request.method in ("PUT", "PATCH", "DELETE") else None)
    ui.page.route("**/device-plugins/gpu/mode?*", lambda route: route.abort()
                  if route.request.method == "PUT" else route.continue_())
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/nodes/{name}")
    expect(ui.page.locator('[data-ai-id="node-detail:basic"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="node-detail:usage"]')).to_be_visible()
    expect(ui.page.locator('[data-ai-id="node-detail:trend"]')).to_have_attribute("data-ai-state", "ready", timeout=30_000)
    reported = node["status"]
    def count(value):
        text = str(value)
        return float(text[:-1]) / 1000 if text.endswith("m") else float(text)

    for kind, field in (("requests", "allocated"), ("limits", "allocatedLimits")):
        for key in ("cpu", "nvidia.com/gpu"):
            value = reported.get(field, {}).get(key)
            if value is not None:
                text = ui.page.locator(f'[data-ai-id="node-detail:{kind}:{key}"]').inner_text()
                total = count(reported["allocatable"][key])
                assert f"({int(count(value) / total * 100 + .5)}%)" in text
                if key == "nvidia.com/gpu":
                    assert str(value) in text
    for condition in reported.get("conditions", []):
        if condition["type"] in ("MemoryPressure", "DiskPressure", "PIDPressure", "NetworkUnavailable"):
            tone = "success" if condition["status"] == "False" else "danger" if condition["status"] == "True" else "neutral"
            expect(ui.page.locator(f'[data-ai-id="node-detail:condition:{condition["type"]}"]')).to_have_attribute("data-ai-tone", tone)
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 1000})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        screenshot(ui.page, f"node-detail-layout-{width}")
    ui.page.locator('[data-ai-id="node-detail:gpu-mode"]').click()
    expect(ui.page.get_by_role("dialog")).to_be_visible()
    ui.page.locator('[data-ai-id="node-mode:close"]').click()
    expect(ui.page.get_by_role("dialog")).to_have_count(0)
    ui.page.locator('[data-ai-id="node-detail:tab:hardware"]').click()
    status, ports = ui.api.request("GET", f"/kapis/rdma.kubesphere.io/v1alpha1/ports?nodeName={name}&limit=-1")
    assert status == 200
    exact_ports = [port for port in ports["items"] if port.get("nodeName") == name]
    rows = ui.page.locator('[data-ai-id="node-detail:rdma"] [data-ai-port]')
    expect(rows).to_have_count(len(exact_ports), timeout=30_000)
    for port in exact_ports:
        row = ui.page.locator(f'[data-ai-port="{port["device"]}/{port["port"]}"]')
        expect(row.locator("td").nth(0)).to_have_text(port["device"])
        expect(row.locator("td").nth(2)).to_have_text(str(port["port"]))
        expect(row).to_contain_text(port["stateName"])
        expect(row).to_contain_text(f'{float(port["linkSpeed"]) * 8 / 1e9:g} Gb/s')
    status, cards = ui.api.request("GET", f"/kapis/gpu.kubesphere.io/v1alpha1/gpus?nodeName={name}&limit=-1")
    assert status == 200
    exact_cards = [card for card in cards["items"] if card.get("nodeName") == name]
    expect(ui.page.locator('[data-ai-id="node-detail:cards"] tbody tr')).to_have_count(len(exact_cards), timeout=30_000)
    for card in exact_cards:
        row = ui.page.locator(f'[data-ai-id="node-detail:cards"] tr:has(a[title="{card["uuid"]}"])')
        expect(row.locator("td").nth(0)).to_have_text(str(card["index"]))
        expect(row.locator("td").nth(3)).to_have_text(card["type"])
    topology = reported.get("nodeInfo", {}).get("gpuTopology", [])
    affinity = {"CPU Affinity", "NUMA Affinity", "GPU NUMA ID"}
    for raw in topology:
        identity = [key for key, value in raw.items() if key not in affinity and value == "X"]
        if len(identity) == 1:
            device = identity[0]
            expect(ui.page.locator(f'[data-ai-connection="{device}:{device}"]')).to_have_text("X")
            row = ui.page.locator(f'[data-ai-device="{device}"]')
            for index, key in enumerate(("CPU Affinity", "NUMA Affinity", "GPU NUMA ID")):
                expect(row.locator("td").nth(index - 3)).to_have_text(str(raw.get(key) or "-"))
    if topology:
        first = ui.page.locator('[data-ai-id^="node-detail:topology-select:"]').first
        first.click()
        expect(first).to_be_visible()
        device = first.inner_text()
        assert "font-semibold" in ui.page.locator(f'[data-ai-connection="{device}:{device}"]').get_attribute("class")
    for width in (1024, 1280, 1600):
        ui.page.set_viewport_size({"width": width, "height": 1000})
        assert ui.page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        screenshot(ui.page, f"node-hardware-{width}")
    assert writes == [], "只读验证和取消模式弹窗不得写入生产节点"
