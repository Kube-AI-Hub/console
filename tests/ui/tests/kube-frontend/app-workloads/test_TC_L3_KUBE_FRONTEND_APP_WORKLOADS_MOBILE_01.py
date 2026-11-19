from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui

# Every area migrated after the first three. The older ones have their own mobile
# cases; these did not, and a phone measurement found two real defects (36px tabs and
# text-height sort controls).
PAGES = [
    # Project: configuration (the first three areas)
    ("configmaps", "/kube-frontend/system-workspace/clusters/host/projects/default/configmaps"),
    ("secrets", "/kube-frontend/system-workspace/clusters/host/projects/default/secrets"),
    ("serviceaccounts", "/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts"),
    # Project: application workloads
    ("deployments", "/kube-frontend/system-workspace/clusters/host/projects/spaces/deployments"),
    ("pods", "/kube-frontend/system-workspace/clusters/host/projects/spaces/pods"),
    ("services", "/kube-frontend/system-workspace/clusters/host/projects/spaces/services"),
    ("ingresses", "/kube-frontend/system-workspace/clusters/host/projects/spaces/ingresses"),
    # Project: storage, monitoring, settings
    ("pvc", "/kube-frontend/system-workspace/clusters/host/projects/csghub/persistentvolumeclaims"),
    ("alerts", "/kube-frontend/system-workspace/clusters/host/projects/default/alerts"),
    ("baseinfo", "/kube-frontend/system-workspace/clusters/host/projects/default/baseinfo"),
    ("members", "/kube-frontend/system-workspace/clusters/host/projects/spaces/members"),
    ("network", "/kube-frontend/system-workspace/clusters/host/projects/spaces/networkpolicies"),
    ("gateways", "/kube-frontend/system-workspace/clusters/host/projects/default/gateways"),
    # Cluster scope
    ("nodes", "/kube-frontend/clusters/host/nodes"),
    ("components", "/kube-frontend/clusters/host/components"),
    ("storageclasses", "/kube-frontend/clusters/host/storageclasses"),
    # Platform scope
    ("users", "/kube-frontend/access/users"),
    ("clusterroles", "/kube-frontend/access/clusterroles"),
    ("workspaces", "/kube-frontend/access/workspaces"),
    ("psettings", "/kube-frontend/settings/info"),
]


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_APP_WORKLOADS_MOBILE_01(app_workloads_page, screenshot):
    """TC-L3-KUBE-FRONTEND-APP_WORKLOADS-MOBILE-01 移动端：各功能区页面可横向容纳且触摸目标达标。"""

    page = app_workloads_page.page
    # `<origin>/kube-frontend/<ws>/clusters/<cluster>/projects/<ns>` → `<origin>`
    base = app_workloads_page.base.split("/kube-frontend/")[0]
    page.set_viewport_size({"width": 375, "height": 812})

    for label, path in PAGES:
        page.goto(f"{base}{path}")
        try:
            expect(page.locator('[data-ai-id$=":surface"]').first).to_be_visible(timeout=30_000)
        except AssertionError as error:
            # Name the page: the loop covers 13 routes and "no surface" alone does not say which
            # one stopped rendering (it cost a round to guess, 2026-11-19).
            raise AssertionError(f"{label} ({path}): 页面没有渲染出任何 *:surface\n{error}") from error
        page.wait_for_timeout(2500)

        scroll_width = page.evaluate("() => document.documentElement.scrollWidth")
        assert scroll_width <= 375, f"{label}: horizontal scroll ({scroll_width}px)"

        # WCAG 2.5.8: a pointer target is at least 24×24. The shell aims higher (44px on
        # touch); this floor is what the case enforces, since a link that is just text
        # height is the failure this catches.
        tiny = page.evaluate(
            """() => {
                const out = [];
                for (const el of document.querySelectorAll('button, a[data-ai-id]')) {
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 || r.height === 0) continue;
                    if (r.height < 24 || r.width < 24) {
                        out.push((el.getAttribute('data-ai-id') || el.textContent || '').trim().slice(0, 24));
                    }
                }
                return out.slice(0, 5);
            }"""
        )
        assert tiny == [], f"{label}: touch targets under 24px: {tiny}"

    screenshot(page, "mobile-new-areas")
