# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01 系统组件详情与后端容器组

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `component-detail`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/components`
- **需求**: `prd/kube-frontend/cluster-management/component-detail.md`

## 产品功能

从系统组件列表点击组件名进入详情，展示健康/后端数量/启动时间与该组件的后端容器组。

### 关联需求

- `prd/kube-frontend/cluster-management/component-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/component-detail.md`](../../../../prd/kube-frontend/cluster-management/component-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENT_DETAIL-01** — 已知系统组件列表中有组件，当点击组件名称，则进入组件详情：显示组件名称、健康状态标记、后端数量、所在命名空间与启动时间；并列出该命名空间中名称以组件名为前缀的后端容器组（名称、状态、所在节点），没有后端时显示明确空态而不是空白；组件名不存在时显示「不存在」提示。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/component-detail.md`](../../../../design/kube-frontend/cluster-management/component-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/component-detail.md`](../../../../prd/kube-frontend/cluster-management/component-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从「异常」走到「哪几个 Pod 异常」 (Priority: P2)

作为 **集群管理员**，我希望 **打开组件的详情看到它的后端容器组**，以便 **在组件不健康时直接定位到具体 Pod**。

**Independent Test**：从列表点击组件名进入详情，页面上能看到健康徽标与后端容器组区域（有 Pod 或明确空态）。

## 前置与配置

- 已登录且可读取集群组件与容器组

## 测试步骤

1. 打开系统组件列表
2. 点击第一个组件名称
3. 观察详情字段与后端容器组表

## 期望结果

- 上述两段都可见（不需要写操作）

## 失败排查

- 详情 404：路由未注册（components/$name）
- 后端容器组一直为空：该组件无后端或命名空间不可读

## 产品改版后如何更新自动化

- 选择器：component-detail / component-detail:pods / component-detail:no-pods
