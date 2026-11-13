from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_SETTINGS_01(cluster_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01 集群设置：编辑与清空描述、只读字段。"""

    ui = cluster_settings_page
    assert ui.api is not None

    original = ui.description_annotation()
    cluster = ui.cluster_object()
    if cluster is None:
        pytest.skip("无法读取集群对象，无法核对设置页")

    marker = "tc-e2e-描述-待还原"
    try:
        ui.open()
        ui.wait_ready()

        # ---- AC-01: installer-owned fields are shown read-only, not as editable controls ----
        readonly = ui.readonly_text()
        for label in ("供应者", "Kubernetes 版本", "KubeSphere 版本", "连接方式", "API 端点", "节点数"):
            assert label in readonly, f"只读区缺少 {label}: {readonly}"

        # ---- AC-01: a saved description is really written ----
        ui.edit_description(marker)
        ui.wait_saved()
        expect(ui.page.locator('[data-ai-id="cluster-settings:description"]').last).to_contain_text(marker, timeout=20_000)
        assert ui.description_annotation() == marker, (
            f"页面显示已保存，但注解仍是 {ui.description_annotation()!r}"
        )

        # ---- AC-02: clearing deletes the annotation instead of leaving an empty string ----
        ui.edit_description("")
        ui.wait_saved()
        assert not ui.description_present(), (
            "清空描述后注解仍然存在；merge patch 需要显式发送 null 才会删除键"
        )
        expect(ui.page.locator('[data-ai-id="cluster-settings:description"]').last).to_have_text("-", timeout=20_000)

        screenshot(ui.page, "cluster-settings")
    finally:
        # Always put the annotation back: this object belongs to the installation, not
        # to the test run, and leaving our marker behind would show up on the overview.
        status = ui.restore_description(original)
        assert status in (200, 201), f"无法还原集群描述注解: {status}"
        assert ui.description_annotation() == original
