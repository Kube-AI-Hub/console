# 删除负载（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/delete.md)

## 概述

行操作与批量删除共用 `DeleteDialog`。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01`
- `prd/kube-frontend/app-workloads/delete.md`

## 设计目标与非目标

与配置字典一致的删除交互。非目标：回收站与恢复。

## 关键约束

- 删除走原生端点（按 API 组）。
- 批量删除逐个下发，不做事务。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01 — 批量删除不做乐观移除

**为什么**：多个对象逐个删除，中途失败是常态。先把行从本地列表移除会让「实际还在」的对象看不见，用户以为删掉了。

**被否方案**：乐观更新 + 失败回滚。回滚时机与顺序都难做对，收益只是省一次请求。

**何时重新考虑**：后端提供批量删除的事务语义时。

## 系统现状

老 console 的删除弹窗要求输入名称确认；新页面只要求确认（与配置字典一致）。

## 仓库落点

- `components/resource/DeleteDialog.tsx`
- `pages/app-workloads/WorkloadListPage.tsx` 与详情页

## 对外契约

`DELETE …/<resource>/<name>`。

## 不变量

- 删除成功后列表刷新，不保留已删除行。

## 已知坑

- 删除 Job 会连带其 Pod；提示文案要说清后果。

## 测试与可观测

- E2E `TC-…-DELETE-01`。

## 后续改进

- 删除保护（例如带 ownerReference 的对象）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DELETE-01`
