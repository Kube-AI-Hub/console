# 智能体可操作性 · 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/ai-surface.md`](../../../prd/kube-frontend/cluster-configmaps/ai-surface.md)。

## 概述

集群级页面的句柄命名与页面清单登记。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01`

## 设计目标与非目标

**目标**：句柄与项目级不冲突，行句柄能区分同名对象。

**非目标**：不引入新的契约格式。

## 关键约束

- 句柄通过 `actionProps` 或 `ListSchema` 的 `aiId` / `selectAiId` / `sortAiPrefix` 生成。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01 — 前缀独立，行句柄含项目

**为什么**：项目级用 `configmaps:`；若集群级沿用同一前缀，智能体在同一页面清单里看到两组同名动作无法区分。行句柄采用 `<project>/<name>`，因为名称只在项目内唯一。

**被否方案**：复用 `configmaps:select:<name>`。跨项目列表里同名对象会产生重复句柄。

## 系统现状

`ResourceList` 的 `selectAiId` 在复选框上输出 `<aiId>:<rowKey>`；行键在这里是 `namespace/name`。

## 仓库落点

- `apps/console-next/src/pages/configmaps/ClusterConfigMapsPage.tsx`
- `apps/console-next/src/pages/configmaps/queries.ts`（页面清单条目）

## 对外契约

- 句柄：`cluster-configmaps:surface` / `:search` / `:create` / `:select:<ns>/<name>` / `:bulk-delete` / `:retry`
- 行属性：`data-ai-row="<ns>/<name>"`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01** — 行句柄在页内唯一。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01** — `rowKey` 若只取 `name`，同名对象的 React key 会重复，表格会错行。

## 测试与可观测

- `config/ai-surface-contract.test.ts` 与 `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01`。

## 后续改进

- 清单里补充「筛选项目」动作。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-AI_SURFACE-01`
