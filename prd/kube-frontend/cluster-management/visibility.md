# 集群可见性（L3）

[子模块需求](./_index.md)

## 概述

决定本集群对哪些企业空间可见。KubeSphere 把它记录为集群对象上的一个**标签**：`cluster.kubesphere.io/visibility`，取值 `public` 或 `private`（缺省视为 private）。本页读写这个标签。

## 用户故事

### US1 - 把集群开放给所有企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **把集群设为公开或私有**，以便 **控制哪些企业空间能看到并使用它**。

**Independent Test**：切换为公开 → 回读集群对象标签为 `public`；切回私有 → 标签为 `private`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03** — 已知集群为「私有」，当打开集群可见性页，则「可使用该集群的企业空间」列出所有企业空间并显示授权状态：`spec.placement.clusters` 含本集群的显示「已授权」且勾选，未含的显示「未授权」且未勾选；勾选/取消勾选对该空间的 Workspace 发 `application/json-patch+json` PATCH（`add /spec/placement/clusters/-` 或 `remove /spec/placement/clusters/<index>`），成功后回读新状态；`spec.placement.clusterSelector` 存在的空间显示「按标签选择集群 / 已按标签覆盖」且不提供开关；集群为「公开」时该区块整体只读并说明原因。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01** — 已知打开集群可见性页，当选择「公开」，则集群对象的 `cluster.kubesphere.io/visibility` 标签变为 `public`，徽标同步显示「公开」；再选择「私有」，标签变回 `private`；页面其余标签（如 `kubesphere.io/workspace`）不被改动。

## 设计目标

1. 只改一个标签，不动对象的其它字段。
2. 选择即时反馈（不依赖刷新），失败时回退到实际值。

## 约束与边界

- 读集群对象；写 `PATCH /apis/cluster.kubesphere.io/v1alpha1/clusters/<name>`（merge patch，仅 `metadata.labels`）。
- 「哪些企业空间被授权」的列表与授权操作不在本页：需要联邦工作空间资源，属独立功能点。

## UI 交互设计

- 面板顶部：当前可见性徽标（公开 / 私有）。
- 两个单选项：私有（只有被授权的空间可用）、公开（所有空间可用），选中立即保存。
- 底部一行说明：企业空间授权列表暂未迁移。

## 文案与校验

- 公开：所有企业空间都能看到并使用该集群。
- 私有：只有被授权的企业空间能看到该集群。

## 边界情况

- 标签缺失：按 private 显示与保存（平台默认）。
- 保存失败：显示服务端原因，选项回退到实际值。
- 读取失败：错误面板 + 重试。

## 明确不做

- 企业空间授权列表与授权变更（需要联邦工作空间资源）。
- 集群角色与项目可见性的联动。

## 假设

- 平台以该标签决定企业空间可见性，缺省为私有。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01** — 读 `cluster.kubesphere.io/visibility` 标签，缺省 private。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-02** — 以 merge patch 只写该标签。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-VISIBILITY-01** — 切换后回读标签与页面显示一致，其它标签不变。
