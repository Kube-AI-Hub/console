# 工作台入口（L3）

[子模块需求](../../../prd/kube-frontend/workbench/entry.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01
- AC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-02

## 概述

工作台（`/kube-frontend/`）列出企业空间与其项目，作为进入项目控制台的入口。

## 系统现状

- 老 console 的「工作台」是个人仪表盘（`src/pages/console/containers/Dashboard`），项目控制台从集群/企业空间下钻进入。
- 本应用此前 `/` 是占位页（硬编码一条链接），而顶部「工作台」指向 `/kube-frontend/`——该路径**没有路由**，点击落到 Not Found。

## 仓库落点

- `apps/console-next/src/pages/workbench/WorkbenchPage.tsx`
- `src/routes/kube-frontend.index.tsx`（正式路由）与 `src/routes/index.tsx`（`/` 重定向）
- `src/components/projects/useProjects.ts` 的 `useProjectsByWorkspace`

## 对外契约

读集群列表、企业空间列表与各集群的命名空间列表；不写。

## 设计目标与非目标

目标：入口可达、层级可见、点一次进项目。非目标：仪表盘统计、创建项目。

## 关键约束

- 只把带 `kubesphere.io/workspace` 标签的命名空间当成项目。
- 项目按 `(集群, 命名空间)` 唯一：同名项目可能存在于不同集群。

## 方案决策

### DEC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01 — 项目来自集群命名空间列表，而不是 tenant 的 namespaces 接口

**为什么**：`/workspaces/<ws>/namespaces` 返回的条目**不带集群**，而进入项目控制台必须知道集群；集群的命名空间列表带 `kubesphere.io/workspace` 标签，正好能把两个维度拼起来。

**被否方案**：用 tenant 接口拿项目、再反查集群——每个项目一次请求，且跨集群时无法确定。

**何时重新考虑**：tenant 接口开始返回集群字段。

### DEC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-02 — `/kube-frontend/` 是正式路由，`/` 只做重定向

**为什么**：应用所有路由都在 `/kube-frontend/` 下，顶部入口也指向它；原来只有 `/` 有页面，于是入口点空。

**被否方案**：把顶部入口改成 `/`。代价是控制台出现一个不属于自己前缀的地址。

**何时重新考虑**：控制台不再挂在 `/kube-frontend` 前缀下。

## 不变量

1. 顶部「工作台」永远能到达页面。
2. 没有企业空间归属的命名空间不出现在工作台。

## 已知坑

- 工作台的项目是按集群异步加载的，测试必须在页面 ready 之后再等分组出现，否则会读到空列表并误判为空态。

## 测试与可观测

E2E：`tests/kube-frontend/workbench/`。

## 后续改进

- 企业空间标题链到企业空间控制台（Phase 2）。
- 显示项目状态与最近访问。

## 验收用例

- `TC-L3-KUBE-FRONTEND-WORKBENCH-ENTRY-01`
- `TC-FULL-KUBE-FRONTEND-WORKBENCH-01`
