from __future__ import annotations

import pytest
from playwright.sync_api import expect

from pages.devops_page import DevopsPage

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_DEVOPS_PROJECTS_04(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PROJECTS-04 工程创建、编辑信息、删除与 CD 白名单。"""

    ui = cluster_management_page
    assert ui.api is not None
    devops = DevopsPage(ui.page, ui.base_url, ui.cluster, ui.api)

    # The create API appends a 5-character suffix, so the typed name is a prefix of the
    # object name; every assertion below uses the name the API returned.
    generate_name = devops.unique("pwspec-proj")
    alias = f"spec-proj-{generate_name[-6:]}"
    alias_edited = alias + "-v2"
    description = "devops spec project create"
    description_edited = "devops spec project edited"
    created_name = ""

    try:
        devops.open_list()
        devops.click("devops:create")
        devops.expect_dialog()

        # Empty name must be rejected without a request.
        devops.click("devops:create-submit")
        expect(devops.dialog()).to_contain_text("请输入名称。")

        devops.fill("devops:create-name", generate_name)
        # Wait for the workspace query (the dialog's select would otherwise have no options).
        expect(devops.locator("devops:create-workspace")).not_to_have_text("选择企业空间", timeout=30_000)
        devops.select("devops:create-workspace", "system-workspace")
        devops.fill("devops:create-alias", alias)
        devops.fill("devops:create-description", description)
        devops.click("devops:create-submit")

        # Success navigates to the generated name's detail page.
        expect(devops.surface("devops-detail:surface")).to_be_visible(timeout=60_000)
        expect(devops.surface("devops-detail:surface")).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
        created = next((p for p in devops.projects() if str(p["metadata"]["name"]).startswith(generate_name)), None)
        assert created is not None, f"创建后列表没有以 {generate_name} 开头的工程"
        created_name = str(created["metadata"]["name"])
        assert created_name != generate_name, "接口应追加 5 位后缀"
        labels = created["metadata"].get("labels") or {}
        annotations = created["metadata"].get("annotations") or {}
        assert labels.get("kubesphere.io/workspace") == "system-workspace", labels
        assert annotations.get("kubesphere.io/alias-name") == alias, annotations
        assert annotations.get("kubesphere.io/description") == description, annotations

        # The namespace falls back to the project name until the controller syncs it, and
        # the page must show the value it actually uses.
        namespace = devops.namespace_of(created)
        expect(devops.surface("devops-detail:namespace")).to_have_text(namespace, timeout=60_000)

        # ---- edit information: name read-only, alias/description replaced ----
        devops.click("devops-detail:edit")
        devops.expect_dialog()
        expect(devops.surface("devops-detail:edit-alias")).to_have_value(alias)
        devops.fill("devops-detail:edit-alias", alias_edited)
        devops.fill("devops-detail:edit-description", description_edited)
        devops.click("devops-detail:edit-info-submit")
        devops.expect_dialog_closed()
        expect(devops.surface("devops-detail:title")).to_have_text(alias_edited, timeout=30_000)
        expect(devops.surface("devops-detail:description")).to_contain_text(description_edited)
        updated = devops.project(created_name)
        updated_annotations = updated["metadata"].get("annotations") or {}
        assert updated_annotations.get("kubesphere.io/alias-name") == alias_edited
        assert updated_annotations.get("kubesphere.io/description") == description_edited

        # ---- CD allow-list: two text areas, saved as spec.argo and read back ----
        devops.click("devops-detail:allowlist-edit")
        devops.expect_dialog()
        devops.fill("devops:cd-allowlist-repos", "repo-a\nrepo-b")
        devops.fill("devops:cd-allowlist-destinations", "host/default\nhost/prod")
        devops.click("devops:cd-allowlist-submit")
        devops.expect_dialog_closed()
        expect(devops.surface("devops-detail:allowlist-repos")).to_contain_text("repo-a", timeout=30_000)
        allowlisted = devops.project(created_name)
        argo = (allowlisted.get("spec") or {}).get("argo") or {}
        assert argo.get("sourceRepos") == ["repo-a", "repo-b"], argo
        destinations = [(d.get("name"), d.get("namespace")) for d in (argo.get("destinations") or [])]
        assert destinations == [("host", "default"), ("host", "prod")], destinations

        # ---- delete: typed-name confirmation, back to the list, row gone ----
        devops.delete_via_dialog("devops-detail:delete", "devops-detail", created_name)
        expect(devops.surface("devops:surface")).to_be_visible(timeout=60_000)
        assert ui.page.url.rstrip("/").endswith("/devops"), ui.page.url
        assert all(str(p["metadata"]["name"]) != created_name for p in devops.projects())
        expect(ui.page.locator(f'[data-ai-id="devops:link:{created_name}"]')).to_have_count(0)
        created_name = ""

        screenshot(ui.page, "devops-project-lifecycle")
    finally:
        if created_name:
            devops.delete_project_quiet(created_name)
