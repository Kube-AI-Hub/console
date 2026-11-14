from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

IAM = "/kapis/iam.kubesphere.io/v1alpha2"
ROLEBINDINGS = "/apis/rbac.authorization.k8s.io/v1/namespaces/default/rolebindings"


def _read(ui, path: str) -> dict:
    status, body = ui.api.request("GET", path)
    assert status == 200, f"GET {path} -> {status}: {str(body)[:300]}"
    return body if isinstance(body, dict) else {}


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_PROJECT_SETTINGS_ROLE_DETAIL_01(project_settings_page, screenshot):
    """TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_DETAIL-01 项目角色详情 · 权限规则与已授权用户。"""

    ui = project_settings_page
    assert ui.api is not None

    # The authorized-users tab comes from RoleBindings, not from users?role=: the latter
    # only covers User subjects, and this cluster's viewer role is held by ServiceAccounts.
    bindings = _read(ui, ROLEBINDINGS).get("items") or []
    subjects_by_role: dict[str, list[dict]] = {}
    for binding in bindings:
        role_ref = binding.get("roleRef") or {}
        role_name = role_ref.get("name") or ""
        if not role_name:
            continue
        for subject in binding.get("subjects") or []:
            name = subject.get("name") or ""
            if not name:
                continue
            subjects_by_role.setdefault(role_name, []).append(
                {"kind": subject.get("kind") or "", "name": name, "namespace": subject.get("namespace") or ""}
            )

    roles = _read(ui, f"{IAM}/namespaces/default/roles?limit=-1").get("items") or []
    if not roles:
        pytest.skip("default 项目没有可读角色")
    role = next((item for item in roles if (item.get("metadata") or {}).get("name") in subjects_by_role), roles[0])
    role_name = (role.get("metadata") or {}).get("name") or ""
    assert role_name
    expected_subjects = subjects_by_role.get(role_name, [])

    detail = _read(ui, f"{IAM}/namespaces/default/roles/{role_name}")
    expected_rules = detail.get("rules") or []

    # Enter through the list: the link is part of the feature.
    ui.page.goto(f"{ui.base_url}/kube-frontend/system-workspace/clusters/{ui.cluster}/projects/default/roles")
    list_surface = ui.page.locator('[data-ai-id="roles:surface"]').last
    expect(list_surface).to_be_visible(timeout=30_000)
    expect(list_surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    ui.page.locator(f'[data-ai-id="project-role-detail:link:{role_name}"]').last.click()

    surface = ui.page.locator('[data-ai-id="project-role-detail:surface"]').last
    expect(surface).to_be_visible(timeout=30_000)
    expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=120_000)
    assert surface.get_attribute("data-ai-state") == "ready"

    # Default tab: rules.
    expect(ui.page.locator('[data-ai-id="project-role-detail:tab:rules"]').last).to_have_attribute("aria-selected", "true")
    if expected_rules:
        rule_rows = ui.page.locator('[data-ai-id="project-role-detail:rule-table"] tbody tr[data-ai-row]')
        expect(rule_rows).to_have_count(len(expected_rules), timeout=30_000)
    else:
        expect(ui.page.locator('[data-ai-id="project-role-detail:empty-rules"]').last).to_be_visible(timeout=20_000)

    # Authorized users tab.
    ui.page.locator('[data-ai-id="project-role-detail:tab:users"]').last.click()
    users = ui.page.locator('[data-ai-id="project-role-detail:users"]').last
    expect(users).to_be_visible(timeout=20_000)
    if expected_subjects:
        # The bindings request is separate from the role request; wait for its content, not
        # just for the tab, or the header read races the fetch and sees a skeleton.
        expect(ui.page.locator('[data-ai-id="project-role-detail:user-table"]')).to_be_visible(timeout=60_000)
        headers = [value.strip() for value in users.locator("thead th:visible").all_inner_texts() if value.strip()]
        assert headers == ["类型", "名称", "命名空间"], headers
        user_rows = ui.page.locator('[data-ai-id="project-role-detail:user-table"] tbody tr[data-ai-row]')
        expect(user_rows).to_have_count(len(expected_subjects), timeout=30_000)
        rendered = user_rows.evaluate_all("els => els.map(e => e.getAttribute('data-ai-row'))")
        expected = sorted(f"{subject['kind']}/{subject['name']}" for subject in expected_subjects)
        assert sorted(str(value) for value in rendered) == expected
        first = expected_subjects[0]
        expect(ui.page.locator(f'[data-ai-id="project-role-detail:user:{first["name"]}"]').last).to_be_visible()
    else:
        expect(ui.page.locator('[data-ai-id="project-role-detail:users-empty"]').last).to_be_visible(timeout=20_000)

    screenshot(ui.page, "project-role-detail")
