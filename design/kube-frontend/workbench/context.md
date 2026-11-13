# 项目上下文栏（L3）

[子模块需求](../../../prd/kube-frontend/workbench/context.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01

## 概述

项目控制台顶部的三级上下文：企业空间 · 集群 · 项目。

## 系统现状

老 console 的项目控制台侧栏顶部是项目选择器（`projects/components/Selector`，带 workspace 与 cluster 参数）；本应用此前只有项目选择器 + 集群只读文本，企业空间只出现在 URL 里，且项目下拉跨企业空间。

## 仓库落点

- `apps/console-next/src/shell/WorkspaceBar.tsx`
- `components/projects/useProjects.ts` 的 `useProjectOptions(cluster, workspace)`

## 对外契约

读集群列表与项目列表；不写。

## 设计目标与非目标

目标：三级可见、项目不越租户。非目标：在本栏切换企业空间。

## 关键约束

- 项目选项按 `kubesphere.io/workspace` 过滤。
- 引用 `MENU`/`Select` 时用现有组件，不新造控件。

## 方案决策

### DEC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01 — 企业空间在本栏只读

**为什么**：切换企业空间等于换到另一个租户的项目，语义上更接近「换一个工作区」，应由工作台/企业空间控制台承担；在项目页里切换会让人以为是在同一上下文里换项目。

**被否方案**：三处都可切换。代价是「项目属于企业空间」这条关系被模糊掉，且要处理目标企业空间无同名项目的落点问题。

**何时重新考虑**：用户反馈切换企业空间过于频繁。

## 不变量

1. 项目下拉里不出现其它企业空间的项目。
2. 切换集群会保留当前页面段（若目标集群有同名项目）。

## 已知坑

- `useProjectOptions(cluster)` 原本列出集群内全部项目（含系统命名空间）；项目页必须传 workspace，否则跨租户。

## 测试与可观测

E2E：`tests/kube-frontend/workbench/test_TC_L3_KUBE_FRONTEND_WORKBENCH_CONTEXT_01.py`，用一个属于 B 企业空间的项目名确认它不出现在 A 的下拉里。

## 后续改进

- 记住每个企业空间上次的项目。
- 企业空间切换（若决定放开）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01`
