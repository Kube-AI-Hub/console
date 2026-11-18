from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


def _waiting_cluster(ui) -> str | None:
    """The first cluster whose Ready condition is not True, or None when all are ready."""
    status, clusters = ui.api.request("GET", "/kapis/cluster.kubesphere.io/v1alpha1/clusters")
    assert status == 200, status
    for item in clusters.get("items", []):
        ready = next((c for c in item.get("status", {}).get("conditions", []) if c.get("type") == "Ready"), None)
        if ready is None or ready.get("status") != "True":
            return item["metadata"]["name"]
    return None


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_11(cluster_overview_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11 未就绪集群显示等待加入引导。"""
    ui = cluster_overview_page
    target = _waiting_cluster(ui)
    if target is None:
        pytest.skip("环境里没有未就绪集群，等待界面无法验证")

    ui.cluster = target
    ui.open()
    ui.wait_ready()

    waiting = ui.field("waiting")
    expect(waiting).to_be_visible()

    # ---- 整页让位：这些面板在未就绪集群上没有可读数据，不应渲染 ----
    for absent in ("usage-gpu", "usage-cpu", "node-row", "ranking", "basic",
                   "kubernetes-status", "components", "shortcuts", "modules"):
        assert ui.page.locator(f'[data-ai-id="overview:{absent}"]').count() == 0, (
            f"未就绪集群不应渲染 {absent}"
        )

    # ---- 页头仍在：等待期间暂停刷新、kubectl 依然有意义 ----
    for kept in ("surface", "auto-refresh", "shortcut:kubectl"):
        assert ui.page.locator(f'[data-ai-id="overview:{kept}"]').count() >= 1, f"页头缺少 {kept}"

    # ---- 代理集群：三步引导，命令以行内 code 呈现且各出现一次 ----
    status, detail = ui.api.request("GET", f"/kapis/cluster.kubesphere.io/v1alpha1/clusters/{target}")
    assert status == 200, status
    connection = detail.get("spec", {}).get("connection", {}).get("type", "")
    steps = ui.page.locator('[data-ai-id="overview:agent-steps"] li')
    if connection == "proxy":
        expect(steps).to_have_count(3)
        texts = [steps.nth(i).inner_text() for i in range(3)]
        for text, command in zip(texts, ("vi agent.yaml", "agent.yaml", "kubectl create -f agent.yaml")):
            assert text.count(command) == 1, f"命令应恰好出现一次: {command!r} in {text!r}"
        assert steps.locator("code").count() == 3, "每条命令都应是行内 code"

        # 序号来自列表样式，不写进文案：文案里不应出现「1.」这类前缀
        assert not texts[0].lstrip().startswith("1."), texts[0]
    else:
        expect(steps).to_have_count(0)

    # ---- 占位符不能漏到页面上 ----
    body = ui.page.locator("body").inner_text()
    for placeholder in ("{cmd}", "{file}", "{0}"):
        assert placeholder not in body, f"页面上残留占位符 {placeholder}"

    # ---- 重复提示：本页会自动刷新只说一次 ----
    assert body.count("本页会自动刷新") <= 1, "自动刷新提示重复"

    # ---- 手动刷新可用 ----
    expect(ui.page.locator('[data-ai-id="overview:waiting-refresh"]')).to_be_visible()

    screenshot(ui.page, f"overview-waiting-{target}")
