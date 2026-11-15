# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01 扩展资源列表刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `custom-resources-refresh`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/custom-resources`
- **需求**: `prd/kube-frontend/cluster-management/custom-resources-refresh.md`

## 产品功能

CRD 列表与某个 CRD 的实例列表都提供刷新入口，点击后只重发当前查询。

### 关联需求

- `prd/kube-frontend/cluster-management/custom-resources-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources-refresh.md`](../../../../prd/kube-frontend/cluster-management/custom-resources-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES_REFRESH-01** — 已知集群有若干 CRD，当打开自定义资源列表，则「刷新」入口存在且空闲时可用，点击后重新发起请求；当打开某个 CRD 的实例列表，则同样有刷新入口，点击后重新发起该实例查询；句柄分别为 `custom-resources:refresh`、`custom-resource:refresh`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/custom-resources-refresh.md`](../../../../design/kube-frontend/cluster-management/custom-resources-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources-refresh.md`](../../../../prd/kube-frontend/cluster-management/custom-resources-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读扩展资源 (Priority: P1)

作为 **集群管理员**，我希望 **在 CRD 列表与实例列表上直接刷新**，以便 **在安装一个 CRD 或等控制器建出实例后立刻看到结果，而不必退出页面再进来**。

**Independent Test**：打开自定义资源列表点击「刷新」，列表重新发起请求；进入某个 CRD 的实例列表，刷新入口同样存在且可用。

## 前置与配置

- 已登录且有集群管理员权限；集群至少有一个 CRD

## 测试步骤

1. 打开自定义资源列表，确认刷新入口可用并点击，观察请求
2. 打开任一 CRD 的实例列表，确认刷新入口存在且可用

## 期望结果

- 实例页刷新只针对当前 CRD

## 失败排查

- 实例页没有按钮：onRefresh 插到了空态块而不是列表
- 按钮永久禁用：schema 依赖数组缺少 isFetching

## 产品改版后如何更新自动化

- 选择器：custom-resources:refresh / custom-resource:refresh
