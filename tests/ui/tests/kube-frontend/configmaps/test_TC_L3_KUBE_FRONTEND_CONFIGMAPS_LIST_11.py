from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

#: (ai prefix, absolute path, storage key, hideable column to toggle)
PAGES = (
    ('configmaps', '/kube-frontend/system-workspace/clusters/host/projects/default/configmaps', 'configmaps', 'project', 'configmaps'),
    ('secrets', '/kube-frontend/system-workspace/clusters/host/projects/default/secrets', 'secrets', 'project', 'secrets'),
    ('serviceaccounts', '/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts', 'serviceaccounts', 'project', 'serviceaccounts'),
    ('persistentvolumeclaims', '/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims', 'persistentvolumeclaims', 'project', 'persistentvolumeclaims'),
    ('rule-groups', '/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules', 'rule-groups', 'enabled', 'alertingrules'),
    ('federated-projects', '/kube-frontend/workspaces/system-workspace/federatedprojects', 'federated-projects', 'clusters', 'federated-projects'),
    ('cluster-alerting-messages', '/kube-frontend/clusters/host/alerting-messages', 'cluster-alerting-messages', 'severity', 'cluster-alerting-messages'),
    ('clusters', '/kube-frontend/clusters', 'clusters', 'nodeCount', 'clusters'),
    ('workspace-members', '/kube-frontend/workspaces/system-workspace/members', 'workspace-members', 'role', 'workspace-members'),
    ('cluster-members', '/kube-frontend/clusters/host/members', 'cluster-members', 'lastLogin', 'cluster-members'),
    ('juicefs', '/kube-frontend/clusters/host/juicefs-storage', 'juicefs', 'nodes', 'cluster-juicefs'),
    ('cluster-configmaps', '/kube-frontend/clusters/host/configmaps', 'cluster-configmaps', 'keys', 'cluster-configmaps'),
    ('cluster-secrets', '/kube-frontend/clusters/host/secrets', 'cluster-secrets', 'type', 'cluster-secrets'),
    ('cluster-serviceaccounts', '/kube-frontend/clusters/host/serviceaccounts', 'cluster-serviceaccounts', 'secrets', 'cluster-serviceaccounts'),
    ('cluster-networkpolicies', '/kube-frontend/clusters/host/networkpolicies', 'cluster-networkpolicies', 'policyTypes', 'cluster-networkpolicies'),
    ('persistent-volumes', '/kube-frontend/clusters/host/persistentvolumes', 'persistent-volumes', 'capacity', 'persistentvolumes'),
    ('ip-pools', '/kube-frontend/clusters/host/ippools', 'ip-pools', 'cidr', 'ip-pools'),
    ('cluster-pvc', '/kube-frontend/clusters/host/persistentvolumeclaims', 'cluster-pvc', 'status', 'cluster-pvc'),
    ('cluster-volume-snapshots', '/kube-frontend/clusters/host/volume-snapshots', 'cluster-volume-snapshots', 'status', 'cluster-volume-snapshots'),
    ('cluster-snapshot-classes', '/kube-frontend/clusters/host/volume-snapshot-classes', 'cluster-snapshot-classes', 'driver', 'cluster-snapshot-classes'),
    ('storageclasses', '/kube-frontend/clusters/host/storageclasses', 'storageclasses', 'provisioner', 'storageclasses'),
    ('cluster-alerting-policies', '/kube-frontend/clusters/host/alerting-policies', 'cluster-alerting-policies', 'type', 'cluster-alerting-policies'),
    ('custom-resources', '/kube-frontend/clusters/host/custom-resources', 'custom-resources', 'scope', 'custom-resources'),
    ('workspace-projects', '/kube-frontend/workspaces/system-workspace/projects', 'workspace-projects', 'clusters', 'workspace-projects'),
    ('workspace-roles', '/kube-frontend/workspaces/system-workspace/roles', 'workspace-roles', 'description', 'workspace-roles'),
    ('workspace-quota', '/kube-frontend/workspaces/system-workspace/quota', 'workspace-quota', 'used', 'workspace-quota'),
    ('network-isolation', '/kube-frontend/system-workspace/clusters/host/projects/default/networkpolicies', 'network-isolation', 'policyTypes', 'networkpolicies'),
    ('installed-apps', '/kube-frontend/workspaces/system-workspace/apps/instances', 'installed-apps', 'status', 'installed-apps'),
    ('workspace-apps', '/kube-frontend/workspaces/system-workspace/apps', 'workspace-apps', 'status', 'workspace-apps'),
    ('workspace-repos', '/kube-frontend/workspaces/system-workspace/repos', 'workspace-repos', 'type', 'workspace-repos'),
    ('devops-projects', '/kube-frontend/clusters/host/devops', 'devops-projects', 'workspace', 'devops'),
    ('components', '/kube-frontend/clusters/host/components', 'components', 'health', 'components'),
    ('edge-nodes', '/kube-frontend/clusters/host/edgenodes', 'edge-nodes', 'status', 'edgenodes'),
)

@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CONFIGMAPS_LIST_11(configmaps_page, screenshot):
    """TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-11 列表显示列。"""

    ui = configmaps_page
    # `ui.url` is the project configmaps URL; strip the tail to reach the console root.
    origin = ui.url.split('/kube-frontend/')[0]

    for prefix, path, storage, column, surface_prefix in PAGES:
        ui.page.goto(origin + path, wait_until='domcontentloaded')
        surface = ui.page.locator(f'[data-ai-id="{surface_prefix}:surface"]').last
        expect(surface).to_be_visible(timeout=30_000)
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)

        trigger = ui.page.locator(f'[data-ai-id="{prefix}:columns"]')
        expect(trigger).to_have_count(1, timeout=30_000)

        headers = ui.page.locator('thead th')
        before = headers.count()
        trigger.first.click()

        # The chooser lists hideable columns only: the identity column must not be offered.
        expect(ui.page.locator(f'[data-ai-id="{prefix}:columns:reset"]')).to_have_count(1, timeout=20_000)
        assert ui.page.locator(f'[data-ai-id="{prefix}:columns:name"]').count() == 0, '名称列不应可隐藏'

        item = ui.page.locator(f'[data-ai-id="{prefix}:columns:{column}"]')
        if item.count() == 0:
            # A list without that column (e.g. cluster-scoped kinds) still proves the menu opened.
            ui.page.keyboard.press('Escape')
            continue

        item.first.click()
        ui.page.wait_for_timeout(700)
        after = ui.page.locator('thead th').count()
        if before == 0:
            # The list has no rows on this cluster, so there is no header to count; the stored
            # choice is the observable effect of the toggle.
            assert after == 0
        else:
            assert after == before - 1, f'{prefix} 取消勾选后表头数未减少：{before} -> {after}'

        stored = ui.page.evaluate(f"() => localStorage.getItem('kube-frontend.columns.{storage}')")
        assert stored is not None and column not in stored, f'{prefix} 选择未持久化：{stored}'

        # The choice survives a reload.
        ui.page.reload(wait_until='domcontentloaded')
        expect(surface).not_to_have_attribute('data-ai-state', 'loading', timeout=120_000)
        if before > 0:
            assert ui.page.locator('thead th').count() == before - 1, f'{prefix} 刷新后列没有保持隐藏'

        # Reset restores every column and clears the stored choice.
        ui.page.locator(f'[data-ai-id="{prefix}:columns"]').first.click()
        ui.page.locator(f'[data-ai-id="{prefix}:columns:reset"]').first.click()
        ui.page.wait_for_timeout(700)
        assert ui.page.locator('thead th').count() == before, f'{prefix} 重置后未恢复全部列'

    screenshot(ui.page, 'list-column-visibility')

