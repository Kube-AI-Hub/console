# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03 集群网关编辑（复用项目网关对话框）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-gateways`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/cluster`
- **需求**: `prd/kube-frontend/cluster-management/cluster-gateways.md`

## 产品功能

集群网关页「集群网关」页签提供编辑：打开复用项目网关的编辑对话框（类型/副本/追踪/NodePort），保存走 gateway PATCH；集群网关由安装器创建，本页不提供创建/删除。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-gateways.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03** — 已知 host 集群存在安装器创建的集群网关，当打开集群网关页「集群网关」页签，则每行在权限允许时提供「编辑」；点击打开复用项目网关的编辑对话框（带网关名），保存走 gateway PATCH，成功关闭并刷新，失败保留对话框与原因。集群网关页签**不提供创建/删除**：创建属于安装器的 Helm release，删除会移除集群入口控制器；项目网关页签保留既有编辑/删除。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-gateways.md`](../../../../design/kube-frontend/cluster-management/cluster-gateways.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 调整集群网关配置 (Priority: P2)

作为 **集群管理员**，我希望 **在不重建网关的情况下调整集群入口的类型、副本、追踪与 NodePort**，以便 **应对流量变化或排障，而不用动安装器**。

**Independent Test**：集群网关页签打开某行「编辑」，对话框预填当前配置；保存（可先不修改）成功后关闭；无权限时编辑入口隐藏。

## 前置与配置

- 已登录 admin；host 集群存在集群网关（安装器创建，kubesphere-controls-system）
- 用例保存**未修改**的表单（不改变真实配置）

## 测试步骤

1. 打开 /clusters/host/gateways/cluster，等待列表就绪
2. 对集群网关行打开操作菜单「编辑」，确认对话框带网关名
3. 不修改任何字段直接保存；断言对话框关闭、无错误
4. 回读 Gateway 对象确认仍存在

## 期望结果

- 集群网关行显示编辑入口（权限允许时）；项目网关页签仍保留其编辑/删除
- 集群网关页签不显示创建/删除（安装器所有）
- 保存失败保留对话框与原因

## 失败排查

- 无编辑入口：检查行权限 SSAR 是否返回 allowed=false
- 保存报错：确认 patch 的 spec.type/replicas 与服务一致

## 产品改版后如何更新自动化

- 句柄：cluster-gateways:edit（行操作）、gateway:edit:save/error、cluster-gateways:surface
