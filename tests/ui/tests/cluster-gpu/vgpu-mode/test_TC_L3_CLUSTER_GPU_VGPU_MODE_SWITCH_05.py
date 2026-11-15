from __future__ import annotations

import json

import pytest

pytestmark = pytest.mark.ui

ERROR_DETAIL = 'node node201-xpu not found: node "node201-xpu" not found'


@pytest.mark.point
def test_TC_L3_CLUSTER_GPU_VGPU_MODE_SWITCH_05(gpu_page, ui_config, screenshot):
    """TC-L3-CLUSTER-GPU-VGPU_MODE-SWITCH-05 子集群模式切换带 cluster query，失败展示详情。"""

    page = gpu_page.page
    captured: dict[str, str] = {}

    def on_route(route):
        request = route.request
        if request.method == "PUT" and "device-plugins/gpu/mode" in request.url:
            captured["url"] = request.url
            route.fulfill(
                status=404,
                content_type="application/json",
                body=json.dumps({"error": ERROR_DETAIL, "message": ERROR_DETAIL}),
            )
            return
        route.continue_()

    page.route("**/kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode*", on_route)
    try:
        page.goto(ui_config.url("clusters/xc/nodes"), wait_until="domcontentloaded")
        try:
            page.wait_for_selector("thead th", timeout=30_000)
        except Exception:
            pytest.skip("成员集群 xc 的节点页不可用")

        body = page.evaluate("() => document.body.innerText")
        if "node201-xpu" not in body and "没有" in body:
            pytest.skip("成员集群 xc 没有节点")

        opened = page.evaluate(
            """
            () => {
              const rows = Array.from(document.querySelectorAll('tbody tr'))
              const target = rows.find((row) => row.textContent.includes('node201-xpu')) || rows[0]
              if (!target) return false
              const more = target.querySelector('.icon-more, button[aria-label], .ks-dropdown-toggle')
              if (!more) return false
              more.click()
              return true
            }
            """
        )
        if not opened:
            pytest.skip("节点行没有可用的操作按钮")
        page.wait_for_timeout(800)
        page.get_by_text("设置vGPU模式").first.click()
        page.wait_for_timeout(800)
        ok = page.get_by_role("button", name="确定").or_(page.get_by_text("确定")).last
        if ok.count() == 0:
            pytest.skip("vGPU 模式对话框没有确定按钮")
        ok.click()
        page.wait_for_timeout(1500)
        screenshot(page, "xc-vgpu-mode-error")

        url = captured.get("url") or ""
        assert "cluster=xc" in url, f"PUT 未带 cluster=xc: {url}"
        assert "nodeName=" in url
        assert "/kapis/clusters/xc/" not in url
        text = page.evaluate("() => document.body.innerText")
        assert "UPDATE_FAILED" not in text
        assert "更新失败" in text
        assert "node201-xpu" in text
    finally:
        page.unroute("**/kapis/gpu.kubesphere.io/v1alpha1/device-plugins/gpu/mode*")
