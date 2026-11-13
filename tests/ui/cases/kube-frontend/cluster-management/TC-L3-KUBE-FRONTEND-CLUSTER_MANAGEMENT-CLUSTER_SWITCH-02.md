# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02 侧栏按作用域切换 · 平台/集群

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-switch`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-switch.md`

## 产品功能

平台页侧栏是平台导航且高亮当前项；集群页侧栏是集群菜单并显示切换器；两处都不出现项目区条目。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-02** — 平台页（`/clusters`、`/access`）侧栏为平台导航且不含项目区条目、当前项高亮；集群页侧栏为集群菜单且不含项目区条目，同时显示切换器。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-switch.md`](../../../../design/kube-frontend/cluster-management/cluster-switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 左侧导航始终对应当前作用域 (Priority: P1)

作为 **读者**，我希望 **左侧导航显示当前作用域的菜单**，以便 **不会在平台页被带进某个项目**。

**Independent Test**：访问 `/clusters`、`/access/users`、`/clusters/<id>/nodes`，三处侧栏分别为平台导航、平台导航、集群菜单，且当前项高亮。

## 前置与配置

- 已登录，且有平台管理权限

## 测试步骤

1. 访问 /clusters，读取侧栏条目与高亮项
2. 访问 /access/users，读取高亮项
3. 访问 /clusters/<集群>/nodes，读取侧栏条目、高亮项与切换器

## 期望结果

- 平台页侧栏含 集群管理/访问控制/平台设置，不含 工作负载/存储/项目设置
- /access/users 高亮「访问控制」
- 集群页侧栏含 集群概览/节点/项目/配置字典，不含 工作负载，高亮「节点」，切换器可见

## 失败排查

- 高亮错位：Menu 只认 activeKey，条目上的 checked 不生效

## 产品改版后如何更新自动化

- 侧栏结构变化时改 pages/cluster_fleet.py 的 side_nav / active_nav
