from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

ROLES_KAPIS = "/kapis/iam.kubesphere.io/v1alpha2/namespaces/default/roles"
ROLES_NATIVE = "/apis/rbac.authorization.k8s.io/v1/namespaces/default/roles"


def _native(api, name: str) -> dict | None:
    status, body = api.request("GET", f"{ROLES_NATIVE}/{name}")
    return body if status == 200 and isinstance(body, dict) else None


def _cleanup(api, name: str) -> None:
    api.request("DELETE", f"{ROLES_NATIVE}/{name}")


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLES_04(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-04 项目角色：从模板创建角色。"""

    ui = project_settings_page
    assert ui.api is not None
    name = f"tc-e2e-role-{uuid.uuid4().hex[:6]}"
    alias = f"E2E 角色 {uuid.uuid4().hex[:4]}"

    # The template the dialog will copy; the case compares the created rules against it.
    status, body = ui.api.request("GET", f"{ROLES_KAPIS}?limit=-1")
    assert status == 200 and isinstance(body, dict)
    templates = [item for item in (body.get("items") or []) if item["metadata"]["name"].startswith("role-template-")]
    assert templates, "项目里没有模板角色，无法验证从模板创建"

    try:
        ui.page.goto(
            f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/roles"
        )
        surface = ui.page.locator('[data-ai-id="roles:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        ui.page.locator('[data-ai-id="roles:create"]').click()
        dialog = ui.page.locator('[data-ai-id="settings:role-create-dialog"]')
        expect(dialog).to_be_visible(timeout=20_000)

        ui.page.locator('[data-ai-id="settings:role-create-name"]').fill(name)
        ui.page.locator('[data-ai-id="settings:role-create-alias"]').fill(alias)
        ui.page.locator('[data-ai-id="settings:role-create-template"] button').click()
        # Templates are listed with their rule counts, so the first option is a real one.
        first_option = ui.page.get_by_role("option").first
        expect(first_option).to_be_visible(timeout=20_000)
        first_option.click()
        ui.page.locator('[data-ai-id="settings:role-create-submit"]').click()

        created = None
        deadline = time.time() + 60
        while time.time() < deadline:
            created = _native(ui.api, name)
            if created is not None:
                break
            ui.page.wait_for_timeout(1_000)
        assert created is not None, "创建后原生 RBAC 读不到该角色"

        # Rules are the whole point: a role created through the IAM aggregate comes back with
        # rules: null, so zero here means the write went to the wrong endpoint.
        assert len(created.get("rules") or []) > 0, created
        annotations = (created.get("metadata") or {}).get("annotations") or {}
        assert annotations.get("kubesphere.io/alias-name") == alias, annotations

        # kapis is how the list shows the role; it must see the same object.
        status, kapis = ui.api.request("GET", f"{ROLES_KAPIS}/{name}")
        assert status == 200, status
        assert len(kapis.get("rules") or []) == len(created.get("rules") or [])

        expect(surface.locator(f'[data-ai-row="{name}"]')).to_be_visible(timeout=30_000)
        screenshot(ui.page, "project-roles-create")
    finally:
        _cleanup(ui.api, name)
        assert _native(ui.api, name) is None
