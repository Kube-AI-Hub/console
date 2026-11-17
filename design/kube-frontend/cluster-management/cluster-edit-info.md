# 编辑集群信息（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-edit-info.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-02

## 概述

集群列表的行操作「编辑信息」：别名、标签、供应商、描述。

## 系统现状

老 console 的 `clusters/components/Modals/EditBasicInfo` 编辑四项：别名
（`kubesphere.io/alias-name`）、标签（`cluster.kubesphere.io/group`）、供应商（`spec.provider`）、
描述（`kubesphere.io/description`），名称禁用。列表用 `showNameAndAlias` 显示「别名优先」。

## 仓库落点

- `apps/console-next/src/pages/cluster/ClusterEditDialog.tsx`
- `apps/console-next/src/pages/cluster/ClusterIdentityFields.tsx`（与添加集群共用）
- `apps/console-next/src/pages/cluster/MultiClusterListPage.tsx`（行操作与名称列）
- `packages/api-client/src/cluster.ts` 的 `clusterWriteApi.updateBasicInfo`

## 对外契约

`PATCH /apis/cluster.kubesphere.io/v1alpha1/clusters/<name>`，`application/merge-patch+json`。

## 设计目标与非目标

目标：四个字段一次改完。非目标：名称、连接信息、移除集群。

## 关键约束

- 名称不可改：URL 与联邦都引用它。
- 清空必须发 `null`（RFC 7386）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-EDIT-INFO-01 — 独立对话框，不复用通用 EditInfoDialog

**为什么**：通用对话框只编辑注解（别名/描述）；集群还要改标签与 `spec.provider`，两者不在注解里。把通用组件扩展成"有时也改 spec"会让它承担两种语义。

**被否方案**：给 `EditInfoDialog` 加可选的 extra fields。代价是它同时处理两种资源形状，后续改动容易波及其它资源。

**何时重新考虑**：出现第三种"注解 + spec 混合"的资源编辑。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-EDIT-INFO-02 — 标签做成固定下拉

**为什么**：老 console 用预设组（production/development/testing/demo），自由文本会让分组失效。

**被否方案**：自由输入标签值。同名不同写法的标签无法聚合。

**何时重新考虑**：平台支持自定义标签集合。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-EDIT-INFO-03 — 四个字段与「添加集群」共用 `ClusterIdentityFields`

**为什么**：两个对话框收集的是同样的四个字段、同样的提示、同样的选项集。此前各写一份，已经漂移成三种不一致：编辑信息的标签缺 `demo`；供应商是自由文本 `<input list>` 而添加集群是可搜索 `Select`；提示文案来自两套 key。一份共享组件是唯一能让两者不可能再分歧的做法。

**被否方案**：只在编辑信息里复制添加集群的 JSX。下一次改选项时又会有两份要同步。

**何时重新考虑**：两者开始收集不同字段（例如添加集群要按供应商展开额外字段）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-EDIT-INFO-04 — 失败提示放顶部、成功给通知

**为什么**：与添加集群同一形态。字段多时底部提示会被 `max-h-[70vh]` 的滚动区推到确认按钮下面；静默关闭对话框则让读者不确定写没写成功。

**被否方案**：失败只弹 toast（对话框一关原因就没了）；成功静默关闭（旧行为）。

**何时重新考虑**：对话框改为独立路由页。

## 不变量

1. 保存后不重新加载页面，列表查询失效并重取。
2. 清空字段删除键，而不是留空字符串。
3. 标签与供应商的选项集与「添加集群」完全一致（同一常量、同一组件）。

## 已知坑

- merge patch 中**缺失的键表示"不修改"**：清空别名若不显式发 `null`，会显示"已保存"但值还在。
- 名称列若用 `td` 序号定位，加一列就会读到状态列；用 `data-ai-id` 定位。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDIT_INFO-03**：标签是 Radix Select，不再是原生 `<select>`。E2E 的 `select_option()` 会报「Element is not a `<select>` element」，必须点击触发器再点 `role=option`。
- **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-EDIT_INFO-04**：Radix `Select` 拒绝 `value: ''` 的选项；「无」用 `__none__` 哨兵再映射回空串，否则渲染时直接抛错、对话框白屏。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`，写后逐字段读回，并测清空。

## 后续改进

更新 kubeconfig、移除集群。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01`
