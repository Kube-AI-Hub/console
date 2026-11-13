# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01 集群可见性 · 公开/私有标签读写

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `visibility`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/visibility`
- **需求**: `prd/kube-frontend/cluster-management/visibility.md`

## 产品功能

集群可见性以 cluster.kubesphere.io/visibility 标签表达（public/private），页面切换即写入该标签；其它标签不受影响。

### 关联需求

- `prd/kube-frontend/cluster-management/visibility.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/visibility.md`](../../../../prd/kube-frontend/cluster-management/visibility.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01** — 已知打开集群可见性页，当选择「公开」，则集群对象的 `cluster.kubesphere.io/visibility` 标签变为 `public`，徽标同步显示「公开」；再选择「私有」，标签变回 `private`；页面其余标签（如 `kubesphere.io/workspace`）不被改动。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/visibility.md`](../../../../design/kube-frontend/cluster-management/visibility.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/visibility.md`](../../../../prd/kube-frontend/cluster-management/visibility.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把集群开放给所有企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **把集群设为公开或私有**，以便 **控制哪些企业空间能看到并使用它**。

**Independent Test**：切换为公开 → 回读集群对象标签为 `public`；切回私有 → 标签为 `private`。

## 前置与配置

- 已登录平台管理，且对 host 集群有管理权限
- 用例记录原始标签值，finally 中还原

## 测试步骤

1. 读取集群对象，记下 visibility 标签与 workspace 标签
2. 打开集群可见性页，核对当前值与标签一致
3. 选择与当前值相反的一项
4. 回读标签，核对已变更且 workspace 标签未变
5. 再切回原值并回读

## 期望结果

- 页面当前值与标签一致（缺省 private）
- 切换后标签变更，且只变更该标签
- 切回后标签恢复

## 失败排查

- 切换后标签未变：确认写的是 label 而非 annotation
- 其它标签丢失：说明用了 PUT 而非 merge patch
- 点击后界面没变化：单选应本地先生效再等 refetch

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 ClusterVisibilityPage.tsx
