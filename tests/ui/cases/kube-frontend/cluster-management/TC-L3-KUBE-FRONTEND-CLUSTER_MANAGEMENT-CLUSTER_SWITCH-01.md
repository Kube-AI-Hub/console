# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01 集群切换 · 侧栏顶部切换器往返

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-switch`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/cluster-switch.md`

## 产品功能

集群控制台侧栏顶部提供切换器，选择其他集群后落到其概览，并可切回。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-01** — 在集群概览点击切换器选择另一集群，则跳转到该集群的 `/overview`，切换器显示新集群，集群菜单高亮「集群概览」；可切回原集群。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-switch.md`](../../../../design/kube-frontend/cluster-management/cluster-switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群之间直接切换 (Priority: P1)

作为 **平台管理员**，我希望 **在集群控制台里直接切到另一个集群**，以便 **比较或处理多个集群而不必回到列表重新找**。

**Independent Test**：在 `host` 概览点击侧栏顶部切换器，选择另一个集群；地址变为该集群的概览，切换器显示新集群名；再切回 `host`。

## 前置与配置

- 已登录，且有平台管理权限
- 平台为多集群模式
- 至少两个集群（用例自行创建一个，结束删除）

## 测试步骤

1. 在原集群概览打开切换器，核对当前集群与目标集群都在列表里
2. 选择目标集群
3. 核对地址为该集群 overview、切换器显示新集群、菜单高亮概览
4. 再切回原集群

## 期望结果

- 切换后地址为 /clusters/<目标>/overview
- 切换器显示目标集群（别名优先）
- 侧栏高亮「集群概览」

## 失败排查

- 切换无效：切换器按钮需可点击（单集群安装不打开对话框）
- URL 断言失败：用正则匹配路径，避免 glob 与完整 URL 的歧义

## 产品改版后如何更新自动化

- 选择器变化时改 pages/cluster_fleet.py 的 open_switcher
