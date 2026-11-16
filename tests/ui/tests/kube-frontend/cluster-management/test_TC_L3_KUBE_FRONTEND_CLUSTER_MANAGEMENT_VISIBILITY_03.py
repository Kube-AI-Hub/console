from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

WORKSPACES = '/kapis/tenant.kubesphere.io/v1alpha2/workspaces'


def _placements(api) -> dict[str, list[str]]:
    status, body = api.request('GET', f'{WORKSPACES}?limit=-1')
    if status != 200 or not isinstance(body, dict):
        return {}
    out: dict[str, list[str]] = {}
    for item in body.get('items') or []:
        name = (item.get('metadata') or {}).get('name')
        placement = ((item.get('spec') or {}).get('placement') or {})
        if not name:
            continue
        out[name] = [entry.get('name') for entry in (placement.get('clusters') or []) if entry.get('name')]
    return out


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_VISIBILITY_03(cluster_management_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03 集群可见性：企业空间授权开关。"""

    ui = cluster_management_page
    assert ui.api is not None
    cluster = ui.cluster
    before = _placements(ui.api)
    granted = [name for name, clusters in before.items() if cluster in clusters]
    if not granted:
        pytest.skip('没有显式列出该集群的企业空间，授权开关无法验证')
    target = granted[0]

    ui.page.goto(f'{ui.base_url.rstrip("/")}/kube-frontend/clusters/{cluster}/visibility', wait_until='domcontentloaded')
    section = ui.page.locator('[data-ai-id="cluster-visibility:workspaces"]')
    expect(section).to_be_visible(timeout=60_000)

    listing = section.locator('[data-ai-id="cluster-visibility:workspaces:list"]')
    expect(listing).to_be_visible(timeout=60_000)
    expect(listing.locator('li')).to_have_count(len(before), timeout=30_000)

    toggle = section.locator(f'[data-ai-id="cluster-visibility:workspaces:toggle:{target}"]')
    expect(toggle).to_have_count(1, timeout=30_000)
    assert toggle.is_checked(), f'{target} 已授权但复选框未勾选'

    try:
        # Revoke, then confirm the Workspace object lost this cluster.
        # The checkbox is controlled: its DOM state only flips after the patch lands and the list
        # refetches, so click instead of uncheck() (which asserts the state synchronously).
        toggle.click()
        ui.page.wait_for_timeout(4000)
        after_revoke = _placements(ui.api)
        assert cluster not in after_revoke.get(target, []), f'取消授权后 {target} 仍包含 {cluster}：{after_revoke.get(target)}'
        expect(toggle).not_to_be_checked(timeout=20_000)

        # Grant again, restoring the original state.
        toggle.click()
        ui.page.wait_for_timeout(4000)
        after_grant = _placements(ui.api)
        assert cluster in after_grant.get(target, []), f'重新授权后 {target} 未包含 {cluster}：{after_grant.get(target)}'
        expect(toggle).to_be_checked(timeout=20_000)
    finally:
        # Best effort restore even if an assertion above failed mid-way.
        current = _placements(ui.api)
        if cluster not in current.get(target, []):
            ui.api.request('PATCH', f'{WORKSPACES}/{target}', [
                {'op': 'add', 'path': '/spec/placement/clusters/-', 'value': {'name': cluster}},
            ])

    # A workspace that selects clusters by label has no switch, only an explanation.
    selectors = [name for name in before if name not in granted and _selector_workspaces(ui)]
    if selectors:
        assert section.locator(f'[data-ai-id="cluster-visibility:workspaces:toggle:{selectors[0]}"]').count() == 0

    screenshot(ui.page, 'cluster-visibility-workspaces')


def _selector_workspaces(ui) -> bool:
    """True when at least one workspace uses a cluster selector (so the read-only row exists)."""
    status, body = ui.api.request('GET', f'{WORKSPACES}?limit=-1')
    if status != 200 or not isinstance(body, dict):
        return False
    for item in body.get('items') or []:
        placement = ((item.get('spec') or {}).get('placement') or {})
        if placement.get('clusterSelector') is not None:
            return True
    return False

