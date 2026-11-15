from __future__ import annotations

import time
import uuid

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

MEMBERS = "/kapis/iam.kubesphere.io/v1alpha2/clustermembers"
USERS = "/kapis/iam.kubesphere.io/v1alpha2/users"
ROLE_ANNOTATION = "iam.kubesphere.io/clusterrole"


def _members(api) -> list[dict]:
    status, body = api.request("GET", f"{MEMBERS}?limit=-1")
    assert status == 200 and isinstance(body, dict), f"members -> {status}: {str(body)[:200]}"
    return body.get("items") or []


def _member(api, username: str) -> dict | None:
    status, body = api.request("GET", f"{MEMBERS}/{username}")
    return body if status == 200 and isinstance(body, dict) else None


def _role(api, username: str) -> str:
    item = _member(api, username)
    return str(((item or {}).get("metadata") or {}).get("annotations", {}).get(ROLE_ANNOTATION) or "")


def _wait_role(api, username: str, expected: str, timeout: float = 60) -> str:
    deadline = time.time() + timeout
    role = ''
    while time.time() < deadline:
        role = _role(api, username)
        if role == expected:
            return role
        time.sleep(1)
    return role


def _wait_gone(api, username: str, timeout: float = 60) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not [item for item in _members(api) if (item.get('metadata') or {}).get('name') == username]:
            return True
        time.sleep(1)
    return False


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_MEMBERS_02(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_MEMBERS-02 集群成员：邀请、改角色与移除。"""

    ui = cluster_management_page
    assert ui.api is not None
    username = f"tc-e2e-cm-{uuid.uuid4().hex[:8]}"
    bulk_names = [f"tc-e2e-cm-b{i}-{uuid.uuid4().hex[:6]}" for i in range(2)]

    roles = []
    status, body = ui.api.request("GET", "/kapis/iam.kubesphere.io/v1alpha2/clusterroles?limit=-1")
    if status == 200 and isinstance(body, dict):
        for item in body.get("items") or []:
            name = str(((item.get("metadata") or {}).get("name")) or "")
            if name.startswith('cluster-'):
                roles.append(name)
    roles = sorted(set(roles))
    if len(roles) < 2:
        pytest.skip(f"集群可分配角色不足两个，无法验证改角色：{roles}")

    created_user = False
    try:
        # A throwaway platform account: the member write targets a real user name.
        status, _ = ui.api.request(
            "POST",
            USERS,
            {"apiVersion": "iam.kubesphere.io/v1alpha2", "kind": "User",
             "metadata": {"name": username, "annotations": {"kubesphere.io/creator": "admin"}},
             "spec": {"email": f"{username}@example.com", "password": "Passw0rd!"}},
        )
        assert status in (200, 201), f'create user -> {status}'
        created_user = True

        ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{ui.cluster}/members")
        surface = ui.page.locator('[data-ai-id="cluster-members:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute("data-ai-state", "loading", timeout=60_000)

        # ---- self protection: no checkbox, no row actions on the signed-in account ----
        self_row = surface.locator('[data-ai-row="admin"]')
        if self_row.count():
            expect(self_row.locator('input[type="checkbox"]')).to_have_count(0)
            expect(ui.page.locator('[data-ai-id="cluster-members:self"]')).to_have_count(1)

        # ---- invite ----
        ui.page.locator('[data-ai-id="cluster-members:invite"]').click()
        dialog = ui.page.locator('[data-ai-id="cluster-members:invite-dialog"]').last
        expect(dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="cluster-members:invite-submit"]').click()
        expect(ui.page.locator('[data-ai-id="cluster-members:invite-error"]')).to_be_visible(timeout=10_000)
        ui.page.locator('[data-ai-id="cluster-members:invite-username"]').fill(username)
        ui.page.locator('[data-ai-id="cluster-members:invite-role"]').click()
        option = ui.page.get_by_role('option', name=roles[0], exact=True).first
        expect(option).to_be_visible(timeout=20_000)
        option.click()
        ui.page.locator('[data-ai-id="cluster-members:invite-submit"]').click()
        try:
            expect(dialog).to_have_count(0, timeout=30_000)
        except AssertionError:
            # Surface the dialog's own message instead of a bare timeout: a stuck dialog is
            # either a local validation error or a rejected request, and they read differently.
            message = ui.page.locator('[data-ai-id="cluster-members:invite-error"]')
            text = message.inner_text() if message.count() else dialog.inner_text()
            raise AssertionError(f'邀请弹窗未关闭：{text[:300]}')
        assert _wait_role(ui.api, username, roles[0]) == roles[0]

        row = surface.locator(f'[data-ai-row="{username}"]')
        expect(row).to_have_count(1, timeout=60_000)
        assert roles[0] in row.inner_text(), row.inner_text()

        # ---- change role ----
        row.locator('td').last.locator('button').first.click()
        ui.page.locator('[data-ai-id="cluster-members:change-role"]').last.click()
        role_dialog = ui.page.locator('[data-ai-id="cluster-members:role-dialog"]').last
        expect(role_dialog).to_be_visible(timeout=20_000)
        ui.page.locator('[data-ai-id="cluster-members:role-select"]').click()
        target = ui.page.get_by_role('option', name=roles[1], exact=True).first
        expect(target).to_be_visible(timeout=20_000)
        target.click()
        ui.page.locator('[data-ai-id="cluster-members:role-submit"]').click()
        expect(role_dialog).to_have_count(0, timeout=60_000)
        assert _wait_role(ui.api, username, roles[1]) == roles[1]

        # ---- remove (typed confirmation) ----
        row = surface.locator(f'[data-ai-row="{username}"]')
        expect(row).to_have_count(1, timeout=60_000)
        row.locator('td').last.locator('button').first.click()
        ui.page.locator('[data-ai-id="cluster-members:remove"]').last.click()
        remove_dialog = ui.page.locator('[data-ai-id="cluster-members:remove-dialog"]').last
        expect(remove_dialog).to_be_visible(timeout=20_000)
        confirm = ui.page.locator('[data-ai-id="cluster-members:remove-confirm"]')
        expect(confirm).to_be_disabled(timeout=10_000)
        ui.page.locator('[data-ai-id="cluster-members:remove-confirm-input"]').fill(username)
        expect(confirm).to_be_enabled(timeout=10_000)
        confirm.click()
        assert _wait_gone(ui.api, username), '移除后成员集合仍包含该账号'
        expect(row).to_have_count(0, timeout=60_000)

        # ---- batch removal: selection drives a write, so a row nobody may act on is not checkable ----
        for name in bulk_names:
            status, _ = ui.api.request(
                'POST',
                USERS,
                {'apiVersion': 'iam.kubesphere.io/v1alpha2', 'kind': 'User',
                 'metadata': {'name': name, 'annotations': {'kubesphere.io/creator': 'admin'}},
                 'spec': {'email': f'{name}@example.com', 'password': 'Passw0rd!'}},
            )
            assert status in (200, 201), f'create user {name} -> {status}'
        status, _ = ui.api.request('POST', MEMBERS, [{'username': name, 'roleRef': roles[0]} for name in bulk_names])
        assert status in (200, 201), f'bulk invite -> {status}'
        ui.page.reload(wait_until='domcontentloaded')
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=60_000)

        bulk = ui.page.locator('[data-ai-id="cluster-members:bulk-remove"]').first
        expect(bulk).to_be_disabled(timeout=20_000)
        for name in bulk_names:
            ui.page.locator(f'[data-ai-row="{name}"] input[type="checkbox"]').first.check()
        expect(bulk).to_be_enabled(timeout=10_000)
        bulk.click()
        batch_dialog = ui.page.locator('[data-ai-id="cluster-members:remove-dialog"]').last
        expect(batch_dialog).to_be_visible(timeout=20_000)
        for name in bulk_names:
            assert name in batch_dialog.inner_text(), batch_dialog.inner_text()
        ui.page.locator('[data-ai-id="cluster-members:remove-confirm"]').click()
        for name in bulk_names:
            assert _wait_gone(ui.api, name), f'{name} 批量移除后仍在成员集合里'

        screenshot(ui.page, "cluster-members-write")
    finally:
        for name in bulk_names + [username]:
            ui.api.request('DELETE', f'{MEMBERS}/{name}')
            ui.api.request('DELETE', f'{USERS}/{name}')
        if created_user:
            ui.api.request('DELETE', f'{USERS}/{username}')

