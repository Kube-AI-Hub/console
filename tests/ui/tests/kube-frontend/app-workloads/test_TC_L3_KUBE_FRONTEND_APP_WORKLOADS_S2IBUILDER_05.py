from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

S2I = "/apis/devops.kubesphere.io/v1alpha1"


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_S2IBUILDER_05(image_builder_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-05 详情：属性、操作顺序、五页签与 404 回退。"""

    ui = image_builder_page
    name = ui.unique("detail")
    try:
        assert ui.create_builder(name, display_name="详情构建器", service_name="tc-e2e-svc") == 201
        status, _ = ui.request(
            "PATCH",
            f"{S2I}/namespaces/{ui.namespace}/s2ibuilders/{name}",
            {"metadata": {"annotations": {"kubesphere.io/alias-name": "别名甲", "kubesphere.io/description": "描述甲"}}},
            "application/merge-patch+json",
        )
        assert status == 200, status

        ui.open_detail(name)
        surface = ui.detail_surface()
        expect(surface).to_be_visible()

        assert "详情构建器" in ui.page.locator('[data-ai-id="image-builder-detail:title"]').inner_text()
        assert "尚未构建" in surface.inner_text()
        assert "源码构建" in surface.inner_text()

        labels = ui.attribute_labels()
        for label in ("名称", "项目", "类型", "构建器镜像", "镜像名称", "拉取策略", "代码仓库 / 制品", "创建时间", "创建者", "远程触发器"):
            assert label in labels, labels

        assert ui.attribute_value("构建器镜像") == "dockerhub.kubekey.local/kube-ai-hub/java-8-centos7:v3.2.0"
        assert ui.attribute_value("镜像名称") == "tc-e2e/image"
        assert "hello-world.git" in ui.attribute_value("代码仓库 / 制品")
        trigger = ui.attribute_value("远程触发器")
        assert "s2itrigger" in trigger and name in trigger, trigger

        # Operations are the old four, in the old order.
        text = surface.inner_text()
        positions = [text.index(label) for label in ("运行", "编辑信息", "编辑 YAML", "删除")]
        assert positions == sorted(positions), positions

        # Five tabs, each switching to a panel with its own state.
        assert ui.tab("records").count() == 1
        for key in ("records", "resource-status", "image-artifacts", "environment", "events"):
            assert ui.tab(key).count() == 1, key
        ui.open_tab("records")
        expect(ui.panel("records")).to_be_visible()
        ui.open_tab("resource-status")
        expect(ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')).to_be_visible()
        ui.open_tab("image-artifacts")
        expect(ui.panel("artifacts-empty")).to_be_visible()
        ui.open_tab("environment")
        expect(ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')).to_be_visible()
        ui.open_tab("events")
        expect(ui.page.locator('[data-ai-id="image-builder-detail:no-job"]')).to_be_visible()

        # Edit YAML opens and cancels without changing the object.
        ui.click("image-builder-detail:edit-yaml")
        expect(ui.dialog).to_be_visible()
        ui.dialog.get_by_role("button", name="取消", exact=True).click()
        ui.wait_dialog_closed()
        status, body = ui.get_builder(name)
        assert status == 200
        assert (body.get("metadata") or {}).get("name") == name

        # A missing builder is a not-found page with a way back, not a blank surface.
        ui.page.goto(ui.detail_url(f"{name}-missing"))
        expect(ui.page.locator('[data-ai-id="image-builder-detail:not-found"]')).to_be_visible(timeout=20_000)
        expect(ui.page.locator('[data-ai-id="image-builder-detail:back-to-list"]')).to_be_visible()
        screenshot(ui.page, "image-builder-detail")
    finally:
        ui.delete_builder(name)
