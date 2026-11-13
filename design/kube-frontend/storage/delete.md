# 删除存储对象（L3）

[子模块需求](../../../prd/kube-frontend/storage/delete.md)

## 概述

复用共享删除确认。

## 关联需求
- AC-L3-KUBE-FRONTEND-STORAGE-DELETE-01

- `prd/kube-frontend/storage/delete.md`

## 设计目标与非目标

与配置区同构：共用表格、弹窗与写路径。非目标见 L2 的「明确不做」。

## 关键约束

- 作用域只从路由参数派生。
- 空列表不渲染表头（共享 `Table` 负责）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-DELETE-01 — 与配置区共用组件，不新建

**为什么**：存储与配置的交互完全一致，新写一套只会产生第二套规则。

**被否方案**：为存储单独实现表格与弹窗。

**何时重新考虑**：存储需要配置区没有的交互（例如容量趋势图）时。

## 系统现状

老 console 对应页面已具备同等能力。

## 仓库落点

- `components/resource/DeleteDialog.tsx`

## 对外契约

`DELETE` 原生端点，按 API 组。

## 不变量

删除后列表刷新，不做乐观移除。

## 已知坑

- 删除 PVC 会连带解绑 PV，提示要说清后果。

## 测试与可观测

E2E 见 `tests/kube-frontend/storage/`。

## 后续改进

扩容与快照创建。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-DELETE-01`
