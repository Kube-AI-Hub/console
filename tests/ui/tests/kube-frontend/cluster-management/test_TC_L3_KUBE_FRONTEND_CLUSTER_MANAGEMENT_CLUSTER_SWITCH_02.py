from __future__ import annotations

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.ui


@pytest.mark.point
def test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_CLUSTER_SWITCH_02(cluster_fleet_page, ui_config, screenshot):
    """TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02 左侧导航按作用域切换。"""

    ui = cluster_fleet_page
    cluster = ui_config.cluster

    # ---- 平台页：平台导航，当前项高亮 ----
    #
    # The fleet list belongs to the platform, not to a project. Before this, the sidebar
    # here listed 配置/工作负载/… with nothing highlighted, and clicking one silently moved
    # the reader into the `default` project.
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters")
    expect(ui.page.locator('[data-ai-id="clusters:surface"]').last).to_be_visible(timeout=30_000)
    platform_nav = ui.side_nav()
    for label in ("集群管理", "访问控制", "平台设置"):
        assert label in platform_nav, platform_nav
    # Project areas must not be on offer here.
    for label in ("工作负载", "存储", "项目设置"):
        assert label not in platform_nav, platform_nav
    assert ui.active_nav() is None or "clusters" in (ui.active_nav() or ""), ui.active_nav()

    # ---- 平台页（访问控制）：同一份平台导航，高亮当前项 ----
    ui.page.goto(f"{ui.base_url}/kube-frontend/access/users")
    expect(ui.page.locator('[data-ai-id="users:surface"]').last).to_be_visible(timeout=30_000)
    assert "访问控制" in ui.side_nav(), ui.side_nav()
    highlighted = ui.page.locator('aside a[aria-current="page"]').first.inner_text().strip()
    assert highlighted == "访问控制", highlighted

    # ---- 集群页：集群菜单 + 切换器 ----
    ui.page.goto(f"{ui.base_url}/kube-frontend/clusters/{cluster}/nodes")
    expect(ui.page.locator('[data-ai-id="nodes:surface"]').last).to_be_visible(timeout=30_000)
    cluster_nav = ui.side_nav()
    # 顶部不归组：概览是入口。其余按老 console 分组折叠。
    for label in ("集群概览", "节点", "项目", "系统组件"):
        assert label in cluster_nav, cluster_nav
    assert "工作负载" not in cluster_nav, cluster_nav
    assert ui.active_nav() == "nodes", ui.active_nav()
    # The switcher scopes everything the menu lists, so it sits above it.
    expect(ui.page.locator('[data-ai-id="shell:cluster-switcher"]').first).to_be_visible()

    # ---- 集群菜单分组：11 项平铺读不过来，按老 console 分组 ----
    # 分组标题是折叠触发器（button），不是链接，所以单独取。
    group_labels = [
        text.strip() for text in ui.page.locator("aside button").all_inner_texts() if text.strip()
    ]
    for label in ("资源", "配置", "存储", "监控告警", "集群设置", "扩展"):
        assert label in group_labels, f"集群菜单缺少分组 {label}: {group_labels}"
    # 概览是入口，不归入任何分组，始终可见。
    assert "集群概览" in cluster_nav, cluster_nav
    # 当前页在「资源」组里，所以该组默认展开、同组兄弟可见。
    for sibling in ("节点", "项目", "系统组件"):
        assert sibling in cluster_nav, f"当前页所在分组未展开，缺少 {sibling}: {cluster_nav}"
    # 其它组默认折叠：展开「配置」后才出现该组的页。
    assert "配置字典" not in cluster_nav, f"未展开的分组却渲染了子项: {cluster_nav}"
    ui.page.locator("aside button", has_text="配置").first.click()
    ui.page.wait_for_timeout(500)
    assert "配置字典" in ui.side_nav(), ui.side_nav()

    screenshot(ui.page, "cluster-sidebar-scope")