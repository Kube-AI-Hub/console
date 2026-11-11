# 创建配置字典（集群级）· 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/create.md`](../../../prd/kube-frontend/cluster-configmaps/create.md)。

## 概述

复用项目级创建弹窗，差异在于项目必须由使用者选择。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01`

## 设计目标与非目标

**目标**：不复制弹窗组件，只改变它的初始项目来源。

**非目标**：不做跨项目批量创建。

## 关键约束

- 写走 `/api/v1/namespaces/<ns>/configmaps`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01 — 直接复用 `ConfigMapCreateDialog`

**为什么**：该组件已经接受 `projects` 与 `onNamespaceChange`，并且在初始 `namespace` 为空时校验项目必填。集群级页面只需把筛选器当前值作为默认值传入；选「全部项目」时默认值为空，弹窗自然会要求选择。

**被否方案**：给弹窗加 `scope` 属性。弹窗不需要知道自己在哪个页面——它需要的是「默认项目」和「可选项目」，这两个参数已经存在。

## 系统现状

弹窗的两步骤、键值编辑器、YAML 模式、名称查重均已实现并被项目级用例覆盖。

## 仓库落点

- `apps/console-next/src/pages/configmaps/ClusterConfigMapsPage.tsx`（`onAction('create')` 分支）

## 对外契约

- `POST /api/v1/namespaces/:ns/configmaps`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01** — 提交时 `metadata.namespace` 非空。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01** — 名称查重在项目维度：用列表当前项目去查另一个项目的同名对象会误报「已存在」。

## 测试与可观测

- `test/cluster-configmaps-page.test.tsx`：未选项目时不进入下一步。

## 后续改进

- 支持从当前筛选的项目预填并可一键改用其他项目（已通过默认值部分实现）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-CREATE-01`
