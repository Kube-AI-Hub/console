# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03 集群可见性 · 企业空间授权开关

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `visibility`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/visibility`
- **需求**: `prd/kube-frontend/cluster-management/visibility.md`

## 产品功能

私有集群的可见性页列出所有企业空间并显示是否已授权；勾选/取消勾选通过 Workspace 的 JSON Patch 生效；按标签选择集群的空间只读；公开集群下整块只读。

### 关联需求

- `prd/kube-frontend/cluster-management/visibility.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/visibility.md`](../../../../prd/kube-frontend/cluster-management/visibility.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03** — 已知集群为「私有」，当打开集群可见性页，则「可使用该集群的企业空间」列出所有企业空间并显示授权状态：`spec.placement.clusters` 含本集群的显示「已授权」且勾选，未含的显示「未授权」且未勾选；勾选/取消勾选对该空间的 Workspace 发 `application/json-patch+json` PATCH（`add /spec/placement/clusters/-` 或 `remove /spec/placement/clusters/<index>`），成功后回读新状态；`spec.placement.clusterSelector` 存在的空间显示「按标签选择集群 / 已按标签覆盖」且不提供开关；集群为「公开」时该区块整体只读并说明原因。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/visibility.md`](../../../../design/kube-frontend/cluster-management/visibility.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/visibility.md`](../../../../prd/kube-frontend/cluster-management/visibility.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把集群开放给所有企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **把集群设为公开或私有**，以便 **控制哪些企业空间能看到并使用它**。

**Independent Test**：切换为公开 → 回读集群对象标签为 `public`；切回私有 → 标签为 `private`。

## 前置与配置

- 已登录为平台管理员；集群 host 为私有；存在显式列出集群的企业空间

## 测试步骤

1. 通过 API 读 workspaces 的 spec.placement 记录初始授权状态
2. 打开集群可见性页，核对每个企业空间行的授权状态与 API 一致
3. 取消一个已授权空间的勾选，等列表回读后核对 API 里该空间的 placement 不再含 host
4. 重新勾选，核对 API 恢复原状（测试自清理）
5. 核对按标签选择集群的空间没有开关，只有说明

## 期望结果

- 区块 cluster-visibility:workspaces 存在，行数等于企业空间数
- 复选框状态与 spec.placement.clusters 一致；切换后 API 状态随之变化
- selectorAll 的空间渲染「已按标签覆盖」且无 checkbox
- 公开集群时出现只读说明 :workspaces:public

## 失败排查

- 勾选后 API 没变：PATCH 用了 merge patch 或写到了集群对象上（应写 workspaces/<name> 的 json-patch）
- 取消授权无效：remove 的 index 计算错（应按当前 clusters 数组下标）

## 产品改版后如何更新自动化

- 句柄：cluster-visibility:workspaces / :workspaces:list / :workspaces:toggle:<name> / :workspaces:name:<name> / :workspaces:public / :workspaces:unavailable / :workspaces:error
