# 编辑 YAML（L3）

[子模块需求](../../../prd/kube-frontend/storage/edit-yaml.md)

## 概述

复用共享 YAML 弹窗；先弹加载框再取对象。

## 关联需求
- AC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01

- `prd/kube-frontend/storage/edit-yaml.md`

## 设计目标与非目标

与配置区同构：共用表格、弹窗与写路径。非目标见 L2 的「明确不做」。

## 关键约束

- 作用域只从路由参数派生。
- 空列表不渲染表头（共享 `Table` 负责）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01 — 与配置区共用组件，不新建

**为什么**：存储与配置的交互完全一致，新写一套只会产生第二套规则。

**被否方案**：为存储单独实现表格与弹窗。

**何时重新考虑**：存储需要配置区没有的交互（例如容量趋势图）时。

## 系统现状

老 console 对应页面已具备同等能力。

## 仓库落点

- `components/resource/YamlDialog.tsx`
- `packages/api-client/src/resources.ts`

## 对外契约

`kubePrefix(resource)` 决定写路径；`PATCH` 需 `application/merge-patch+json`。

## 不变量

名称锁定；失败保留弹窗。

## 已知坑

- 快照的 API 组必须登记，否则写操作 404。

## 测试与可观测

E2E 见 `tests/kube-frontend/storage/`。

## 后续改进

扩容与快照创建。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-EDIT_YAML-01`
