from __future__ import annotations

import copy
import json
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_NODES_10(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10 真实只读表单和拦截模式写入状态机。"""
    ui = cluster_management_page
    assert ui.api is not None
    status, before = ui.api.request("GET", "/api/v1/nodes/gpu01")
    assert status == 200
    writes = []
    phase = {"mock": False, "sent": False, "outcome": "completed", "reads": 0}

    def mode_write(route):
        if route.request.method != "PUT":
            route.abort()
            return
        writes.append(route.request.post_data_json)
        assert phase["mock"], "Unexpected production mode write was blocked"
        phase["sent"] = True
        if phase["outcome"] == "denied":
            route.fulfill(status=403, json={"message": "mock forbidden"})
        elif phase["outcome"] == "refused":
            route.fulfill(json={"success": False, "message": "mock signal rejected"})
        else:
            route.fulfill(json={"success": True, "prevMode": "default", "newMode": "hami-core", "message": "signal submitted"})

    # Every GPU endpoint is guarded before opening the form. No PUT can reach B200.
    ui.page.route(re.compile(r".*/kapis/gpu.kubesphere.io/.*"), mode_write)
    ui.open("nodes")
    ui.open_node_action("gpu01", "gpu-mode")
    expect(ui.node_mode_control("surface")).to_have_attribute("data-ai-state", "ready")
    expect(ui.page.get_by_role("combobox", name="GPU 模式", exact=True)).to_contain_text("独占")
    ui.node_mode_control("close").click()
    assert writes == []
    screenshot(ui.page, "node-mode-real-cancel")

    def mode_read(route):
        node = copy.deepcopy(before)
        node["metadata"]["annotations"] = {}
        node["metadata"]["labels"]["xpu-vendor"] = "nvidia"
        node["status"]["nodeInfo"].update({"gpuVendor": "nvidia", "virtualCardMode": "default", "gpuModeParams": {}})
        if phase["sent"]:
            phase["reads"] += 1
            desired = {"mode": "hami-core", "params": {"devicesplitcount": "10", "devicememoryscaling": "1", "devicecorescaling": "1"},
                       "timestamp": "2026-11-14T00:00:10Z"}
            if phase["outcome"] == "external":
                desired["params"]["devicesplitcount"] = "20"
            node["metadata"]["annotations"]["hami.io/gpu-mode-desired"] = json.dumps(desired)
            state = "in_progress" if phase["reads"] < 2 else phase["outcome"]
            timestamp = "2026-11-14T00:00:11Z"
            if phase["outcome"] in ("stale", "timeout"):
                state, timestamp = "completed", "2026-11-14T00:00:01Z"
            node["status"]["nodeInfo"]["gpuModeStatus"] = {"mode": "hami-core", "status": state,
                                                         "timestamp": timestamp, "message": "mock agent failure" if state == "failed" else ""}
        route.fulfill(json=node)

    ui.page.route(re.compile(r".*/kapis/resources.kubesphere.io/v1alpha3/nodes/gpu01(?:\?.*)?$"), mode_read)
    for outcome in ("completed", "failed", "external", "denied", "refused", "stale", "timeout"):
        phase.update({"mock": True, "sent": False, "outcome": outcome, "reads": 0})
        ui.open_node_action("gpu01", "gpu-mode")
        picker = ui.page.get_by_role("combobox", name="GPU 模式", exact=True)
        expect(picker).to_contain_text("独占")
        picker.click()
        ui.page.get_by_role("option", name="HAMi-core", exact=True).click()
        expect(ui.page.get_by_role("textbox", name="设备切分数量", exact=True)).to_have_value("10")
        ui.page.get_by_role("button", name="确认提交模式变更", exact=True).click()
        ui.node_mode_control("submit").click()
        expected_payload = {"mode": "hami-core", "params": {"devicesplitcount": "10", "devicememoryscaling": "1", "devicecorescaling": "1"}}
        assert writes[-1] == expected_payload
        if outcome == "denied":
            expect(ui.page.get_by_role("alert")).to_contain_text("mock forbidden")
        elif outcome == "refused":
            expect(ui.page.get_by_role("alert")).to_contain_text("mock signal rejected")
        elif outcome == "stale":
            expect(ui.node_mode_control("result")).to_have_attribute("data-mode-state", "waiting")
            assert "模式切换完成" not in ui.node_mode_control("surface").inner_text()
        elif outcome == "timeout":
            expect(ui.node_mode_control("result")).to_have_attribute("data-mode-state", "waiting")
            ui.page.clock.install()
            ui.page.clock.fast_forward(300_100)
            expect(ui.node_mode_control("result")).to_have_attribute("data-mode-state", "timeout", timeout=10_000)
        else:
            expect(ui.node_mode_control("result")).to_have_attribute("data-mode-state", outcome, timeout=10_000)
        ui.node_mode_control("close").click()
    status, after = ui.api.request("GET", "/api/v1/nodes/gpu01")
    assert status == 200
    for key in ("hami.io/gpu-mode-desired", "hami.io/gpu-mode-status"):
        assert after["metadata"].get("annotations", {}).get(key) == before["metadata"].get("annotations", {}).get(key)
