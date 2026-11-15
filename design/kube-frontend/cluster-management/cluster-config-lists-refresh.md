# 集群配置与资源列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-config-lists-refresh.md)

## 概述

四个页面各自持有查询，刷新由 `@/components/resource/useListRefresh` 提供。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01

## 设计目标与非目标

目标：四个列表都能主动重读。非目标：轮询、watch。

## 关键约束

- `busy` 进入 schema，schema 的 useMemo 依赖必须包含 `query.isFetching`，否则按钮永久禁用（已在三个页族踩到）。
- 组件列表的 `ResourceList` 首个 prop 是筛选，`onRefresh` 插在标签行之后即可，不影响 props 顺序。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01 — 刷新保留筛选与排序

**为什么**：读者在「组件」页先筛出异常类型再刷新是常见动作；刷新若重置筛选，等于把读者刚做的选择丢掉。实现上刷新只调 `query.refetch()`，列表状态由 `useResourceListState` 保留。

## 系统现状

老 console 的集群配置列表都有刷新；新 UI 此前没有。

## 仓库落点

- 页面：`cluster/{ClusterServiceAccountsPage,ClusterNetworkPoliciesPage,ComponentsPage,IpPoolsPage}.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `cluster-serviceaccounts:refresh`、`cluster-networkpolicies:refresh`、`components:refresh`、`ip-pools:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留筛选、排序与页码。
2. 忙碌状态与实际请求一致。

## 已知坑

- 忘记把 `isFetching` 放进 schema 依赖 → 按钮永久禁用。
- 在 `<ResourceList\n` 之后插入 prop 时不要吞掉下一行的首字符。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG_LISTS_REFRESH-01
