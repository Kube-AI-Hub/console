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

        # The manifest itself, not just the step text. The endpoint answers YAML, and
        # the client used to parse it as JSON: the request returned 200 while the page
        # showed "unknown error" and no document at all. Asserting only the sentence
        # left that failure invisible.
        manifest = ui.page.locator('[data-ai-id="overview:agent-manifest"]')
        expect(manifest).to_be_visible()
        body = manifest.inner_text()
        assert body.lstrip().startswith("---") or "apiVersion:" in body, body[:80]
        assert "kind: Deployment" in body, body[:200]
        expect(ui.page.locator('[data-ai-id="overview:agent-unavailable"]')).to_have_count(0)
        # 复制入口在编辑器自己的角落（`yaml:copy`），页面上不再有第二个「复制清单」按钮。
        expect(ui.page.locator('[data-ai-id="yaml:copy"]')).to_be_visible()
        expect(ui.page.locator('[data-ai-id="overview:agent-copy"]')).to_have_count(0)

        # 三步的文字起点一致：块级子元素会把序号挤开，差 13px 就看得出来
        starts = [steps.nth(i).evaluate("""element => {
            const box = element.getBoundingClientRect();
            const first = element.firstElementChild.getBoundingClientRect();
            return Math.round(first.x - box.x);
        }""") for i in range(3)]
        assert max(starts) - min(starts) < 2, f"步骤文字起点不一致: {starts}"
    else:
        expect(steps).to_have_count(0)

    # ---- 占位符不能漏到页面上 ----
    body = ui.page.locator("body").inner_text()
    for placeholder in ("{cmd}", "{file}", "{0}"):
        assert placeholder not in body, f"页面上残留占位符 {placeholder}"

    # ---- 加载指示已说明在刷新，不再用文案重复 ----
    assert "本页会自动刷新" not in body, "加载指示已经表达刷新中，文案不该再说一遍"
    assert ui.page.locator('[data-ai-id="overview:waiting-hint-auto"]').count() == 0

    # ---- 刷新只有一个入口：页头那个，面板里不再重复 ----
    expect(ui.page.locator('[data-ai-id="overview:refresh"]')).to_be_visible()
    assert ui.page.locator('[data-ai-id="overview:waiting-refresh"]').count() == 0, "等待面板不应再放一个刷新按钮"
    refresh_buttons = [b for b in ui.page.get_by_role("button").all() if b.inner_text().strip().startswith("刷新")]
    assert len(refresh_buttons) == 1, f"页面上应只有一个刷新按钮，实际 {len(refresh_buttons)}"

    screenshot(ui.page, f"overview-waiting-{target}")
