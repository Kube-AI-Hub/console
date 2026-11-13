from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.full
def test_TC_FULL_KUBE_FRONTEND_APP_WORKLOADS_04(app_workloads_page, screenshot):
    """TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-04 应用负载：详情的扩缩容与编辑信息。"""

    ui = app_workloads_page
    name = ui.unique("detailops")
    try:
        assert ui.create_deployment(name, replicas=1, image="nginx:1.27") == name

        ui.page.goto(f"{ui.url('deployments')}/{name}")
        surface = ui.detail_surface("deployments")
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        labels = [b.inner_text().strip() for b in ui.page.locator('[data-ai-id^="deployments-detail:"]').all()
                  if (b.get_attribute("data-ai-id") or "").count(":") == 1 and b.inner_text().strip()]
        for expected in ("编辑信息", "扩缩容", "重新部署", "编辑 YAML", "删除"):
            assert expected in labels, (expected, labels)

        # 编辑信息: the alias is an annotation and must land on the object.
        ui.page.locator('[data-ai-id="deployments-detail:edit-info"]').click()
        ui.page.locator('[data-ai-id="deployments-detail:edit-alias"]').fill("详情别名")
        ui.page.get_by_role("dialog").get_by_role("button", name="确认").click()
        # The save is a PUT that can be slow while the list query is in flight. Waiting is
        # right; what was wrong is that a stuck dialog produced only "expected 0, got 1".
        # Report what the dialog says, so a failed write is distinguishable from slowness.
        try:
            expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=45_000)
        except AssertionError:
            text = ui.page.get_by_role("dialog").inner_text().replace("\n", " | ")
            raise AssertionError(f"编辑信息未关闭，对话框内容：{text[:300]}") from None

        status, body = ui.get_deployment(name)
        assert status == 200
        assert ((body.get("metadata") or {}).get("annotations") or {}).get("kubesphere.io/alias-name") == "详情别名"

        # 扩缩容: one integer, written as a merge patch on spec.replicas.
        ui.page.locator('[data-ai-id="deployments-detail:scale"]').click()
        ui.page.locator("#ai-field-replicas").fill("3")
        ui.page.get_by_role("dialog").get_by_role("button", name="确认").click()
        expect(ui.page.get_by_role("dialog")).to_have_count(0, timeout=20_000)

        ui.wait_replicas(name, 3)
        screenshot(ui.page, "workloads-detail-ops")
    finally:
        ui.delete_deployment(name)
