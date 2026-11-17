# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03 切换集群弹窗 · 搜索与刷新同一行

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-switch`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/cluster-switch.md`

## 产品功能

弹窗里刷新按钮紧贴搜索框右侧，与列表右缘对齐，不再单独占一行。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-03** — 切换器弹窗中搜索框与刷新按钮位于同一行：刷新按钮紧贴搜索框右侧，二者顶边对齐，刷新按钮右缘与下方集群列表右缘对齐；刷新按钮带可访问名称「刷新」，请求进行中时禁用并显示旋转。

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

## 测试步骤

1. 在集群概览打开切换器
2. 读取搜索框与刷新按钮的包围盒
3. 点击刷新并观察按钮状态

## 期望结果

- 搜索框与刷新按钮顶边相同、同一行内，二者间距为一行内的常规间距
- 刷新按钮右缘与下方集群列表右缘对齐
- 刷新按钮可访问名称为「刷新」，请求进行中禁用

## 失败排查

- 行高不一致：搜索框需 min-w-0 flex-1，刷新按钮固定 36px 方形，二者才在同一基线
- 右缘不齐：列表与搜索行须共用同一容器内边距

## 产品改版后如何更新自动化

- 选择器变化时改 pages/cluster_fleet.py 的 open_switcher 与新增的 switcher_search/switcher_refresh
