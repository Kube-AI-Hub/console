from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

from pages.federated_page import FEDERATED, FederatedProjectsPageObject

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
def test_TC_L3_KUBE_FRONTEND_ACCESS_CONTROL_FEDERATED_PROJECTS_08(access_control_page, screenshot):
    """TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-08 联邦资源详情完整对象 YAML 与事件。"""

    ui = access_control_page
    assert ui.api is not None
    fed = FederatedProjectsPageObject(ui.page, ui.base_url, api=ui.api)
    workspace = _workspace(fed)
    project = f"pwfed{uuid.uuid4().hex[:8]}"
    object_name = f"pwfedcm{uuid.uuid4().hex[:8]}"

    try:
        fed.create_project(workspace=workspace, name=project)
        fed.create_federated_configmap(namespace=project, name=object_name, data={"tc-probe": "yes"})

        # The control plane reports distribution a few seconds after creation.
        deadline = time.time() + 60
        reported = False
        while time.time() < deadline:
            status, body = ui.api.request(
                "GET", f"{FEDERATED}/namespaces/{project}/federatedconfigmaps/{object_name}"
            )
            if status == 200 and (body.get("status") or {}).get("clusters"):
                reported = True
                break
            time.sleep(1)
        assert reported, "control plane did not report distribution for the FederatedConfigMap"

        fed.open_detail(workspace, project)
        fed.detail_tab("config").click()
        row_link = ui.page.locator(f'[data-ai-id="federated-project:resource:configmaps/{object_name}"]')
        expect(row_link).to_be_visible(timeout=60_000)
        row_link.click()

        surface = fed.resource_surface()
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        expect(ui.page.locator('[data-ai-id="federated-resource:title"]')).to_have_text(object_name)
        expect(ui.page.locator('[data-ai-id="federated-resource:kind"]')).to_contain_text("FederatedConfigMap")

        template_text = ui.page.locator('[data-ai-id="federated-resource:template"]').inner_text()
        assert "tc-probe" in template_text and "yes" in template_text, template_text

        object_text = ui.page.locator('[data-ai-id="federated-resource:object:yaml"]').inner_text()
        assert "kind: FederatedConfigMap" in object_text, object_text
        assert "spec:" in object_text, object_text
        assert "placement:" in object_text, object_text

        distribution_text = ui.page.locator('[data-ai-id="federated-resource:distribution"]').inner_text()
        assert "host" in distribution_text, distribution_text

        # --- Events tab for the federated object. ---
        ui.page.locator('[data-ai-id="federated-resource:tab:events:trigger"]').click()
        ui.page.wait_for_selector(
            '[data-ai-id="federated-resource:events"], [data-ai-id="federated-resource:events:empty"]',
            timeout=60_000,
        )
        events_table = ui.page.locator('[data-ai-id="federated-resource:events"]')
        if events_table.count() > 0:
            headers = [text.strip() for text in events_table.locator("thead th").all_inner_texts() if text.strip()]
            assert headers == ["级别", "原因", "消息", "次数", "最近发生", "来源"], headers
        else:
            expect(ui.page.locator('[data-ai-id="federated-resource:events:empty"]')).to_contain_text("暂无事件")
        screenshot(ui.page, "federated-resource-detail-events")

        # --- Not found: the page must not render YAML or events for a missing object. ---
        ui.page.goto(fed.resource_url(workspace, project, "deployments", "does-not-exist"))
        not_found = ui.page.locator('[data-ai-id="federated-resource:not-found"]')
        expect(not_found).to_be_visible(timeout=30_000)
        assert "不存在" in not_found.inner_text(), not_found.inner_text()
        expect(ui.page.locator('[data-ai-id="federated-resource:object:yaml"]')).to_have_count(0)
        expect(ui.page.locator('[data-ai-id="federated-resource:events"]')).to_have_count(0)

        # --- Unknown segment is a different sentence from not found. ---
        ui.page.goto(fed.resource_url(workspace, project, "widgets", "does-not-exist"))
        unknown = ui.page.locator('[data-ai-id="federated-resource:not-found"]')
        expect(unknown).to_be_visible(timeout=30_000)
        assert "未知的联邦资源类型" in unknown.inner_text(), unknown.inner_text()
    finally:
        fed.delete_federated_configmap(namespace=project, name=object_name)
        local_path = f"/api/v1/namespaces/{project}/configmaps/{object_name}"
        if ui.api.request("GET", local_path)[0] == 200:
            ui.api.request("DELETE", local_path)
        fed.delete_project(project)
        assert fed.find_project(project) is None
