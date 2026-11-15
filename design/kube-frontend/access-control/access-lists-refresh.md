# 访问控制列表刷新 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/access-lists-refresh.md)

## 概述

平台用户、集群成员、联邦项目三页接入 `useListRefresh`；集群列表沿用其内联刷新（同构列表已带 refresh）。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01

## 设计目标与非目标

目标：四个列表都能主动重读。非目标：轮询、watch。

## 关键约束

- `busy` 进入 schema，schema 的 useMemo 依赖必须包含 `query.isFetching`。
- 平台用户列表按 `kind` 切换（用户/平台角色/企业空间），刷新句柄随 `kind` 变化。
- 插入 `onRefresh` 到 `<ResourceList\n` 之后时要保留下一行首字符（本批踩过一次，出现 `chema={schema}`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01 — 同构列表不重复造按钮

**为什么**：集群列表与节点列表共用同构 schema，已经带刷新；再插一个会出现两个按钮。接入前先确认页面是否已有 `refresh:` 内联定义。

## 系统现状

老 console 的访问控制列表都有刷新；新 UI 此前只有集群列表有。

## 仓库落点

- 页面：`platform/PlatformListPage.tsx`、`cluster/{ClusterMembersPage,ClusterListPage}.tsx`、`federated/FederatedProjectsPage.tsx`
- 共享能力：`components/resource/useListRefresh.ts`

## 对外契约

| 用途 | 句柄 |
| --- | --- |
| 刷新 | `users:refresh`、`cluster-members:refresh`、`clusters:refresh`、`federated-projects:refresh` |
| 空态出口 | `empty-state:refresh`、`empty-state:clear` |

## 不变量

1. 刷新保留搜索、排序与页码。
2. 忙碌状态与实际请求一致。

## 已知坑

- 忘记把 `isFetching` 放进 schema 依赖 → 按钮永久禁用。
- 页面路由不是 `/access-control/*` 而是 `/access/*`（平台作用域），联邦项目是 `/federatedprojects`。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01.yaml`

## 后续改进

- 与 R-27 一起评估轮询。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-ACCESS_LISTS_REFRESH-01
