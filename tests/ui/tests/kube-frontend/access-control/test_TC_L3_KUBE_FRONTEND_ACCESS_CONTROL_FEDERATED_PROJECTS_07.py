from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

from pages.federated_page import FederatedProjectsPageObject

pytestmark = pytest.mark.ui


def _workspace(fed: FederatedProjectsPageObject) -> str:
    for item in fed.project_names():
        template = (((item.get("spec") or {}).get("template") or {}).get("metadata") or {}).get("labels") or {}
        if template.get("kubesphere.io/workspace"):
            return str(template["kubesphere.io/workspace"])
    known = fed.workspaces()
    assert known, "no workspace is visible to this account"
    return "system-workspace" if "system-workspace" in known else known[0]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_07(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07 联邦项目详情传播条件、元数据与事件。"""

    ui = access_control_page
    assert ui.api is not None
    fed = FederatedProjectsPageObject(ui.page, ui.base_url, api=ui.api)
    workspace = _workspace(fed)
    name = f"pwfed{uuid.uuid4().hex[:8]}"

    try:
        fed.create_project(workspace=workspace, name=name, alias="e2e-detail-alias", description="e2e 详情")

        # Wait for the control plane's first report so the conditions table has a row.
        deadline = time.time() + 60
        conditions: list[dict] = []
        while time.time() < deadline:
            current = fed.find_project(name) or {}
            conditions = (current.get("status") or {}).get("conditions") or []
            if any(entry.get("type") == "Propagation" for entry in conditions):
                break
            time.sleep(1)

        fed.open_detail(workspace, name)
        expect(ui.page.locator('[data-ai-id="federated-project:title"]')).to_have_text("e2e-detail-alias")

        basic = ui.page.locator('[data-ai-id="federated-project:basic"]').inner_text()
        for expected in ("e2e-detail-alias", "e2e 详情", name, workspace, "host", "admin"):
            assert expected in basic, (expected, basic)

        # The three write entries the old console offered all exist on the object they act on.
        for handle in ("edit-info", "edit-placement", "delete"):
            expect(ui.page.locator(f'[data-ai-id="federated-project:{handle}"]')).to_be_visible()

        conditions_root = ui.page.locator('[data-ai-id="federated-project:conditions"]')
        expect(conditions_root).to_be_visible()
        if conditions:
            expect(conditions_root.locator('tbody tr[data-ai-row="Propagation"]')).to_have_count(1)
        else:
            expect(ui.page.locator('[data-ai-id="federated-project:conditions:empty"]')).to_be_visible()

        # --- Metadata tab: object labels/annotations and the template labels. ---
        fed.detail_tab("metadata").click()
        labels_panel = ui.page.locator('[data-ai-id="federated-project:metadata:labels"]')
        expect(labels_panel).to_be_visible(timeout=30_000)
        expect(labels_panel).to_contain_text("kubesphere.io/workspace")
        annotations_panel = ui.page.locator('[data-ai-id="federated-project:metadata:annotations"]')
        expect(annotations_panel).to_contain_text("kubesphere.io/alias-name")
        template_panel = ui.page.locator('[data-ai-id="federated-project:metadata:template-labels"]')
        expect(template_panel).to_contain_text("kubesphere.io/workspace")
        screenshot(ui.page, "federated-projects-detail-metadata")

        # --- Events tab: a table with the agreed columns, or the explicit empty sentence. ---
        fed.detail_tab("events").click()
        ui.page.wait_for_selector(
            '[data-ai-id="federated-project:events"], [data-ai-id="federated-project:events:empty"]',
            timeout=60_000,
        )
        events_table = ui.page.locator('[data-ai-id="federated-project:events"]')
        if events_table.count() > 0:
            headers = [text.strip() for text in events_table.locator("thead th").all_inner_texts() if text.strip()]
            assert headers == ["级别", "原因", "消息", "次数", "最近发生", "来源"], headers
            expect(events_table.locator("tbody tr[data-ai-row]").first).to_be_visible()
        else:
            expect(ui.page.locator('[data-ai-id="federated-project:events:empty"]')).to_contain_text("暂无事件")

        screenshot(ui.page, "federated-projects-detail-events")

        # --- A route that outlives its object says so instead of rendering an empty page. ---
        ui.page.goto(fed.detail_url(workspace, name + "-missing"))
        not_found = ui.page.locator('[data-ai-id="federated-project:not-found"]')
        expect(not_found).to_be_visible(timeout=30_000)
        assert "不存在" in not_found.inner_text(), not_found.inner_text()
    finally:
        fed.delete_project(name)
        assert fed.find_project(name) is None
