# 删除配置字典（集群级）· 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/delete.md`](../../../prd/kube-frontend/cluster-configmaps/delete.md)。

## 概述

单条删除的定位方式，以及跨项目批量选择为何拒绝执行。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01`

## 设计目标与非目标

**目标**：删除永远针对确定的一个对象。

**非目标**：不做跨项目批量删除。

## 关键约束

- 删除逐个对象执行，顺序确定。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01 — 批量删除限定在同一项目

**为什么**：删除没有事务。跨项目批量时其中一个失败，页面只剩「部分失败」这个没法回复的状态；更危险的是同名对象——若按名称批量发请求，很容易删掉另一个项目的那条。因此按行收集 `(namespace, name)`，一旦超过一个项目就拒绝执行并提示先按项目筛选。

**被否方案**：按名称跨项目并发删除。等价于「删掉所有叫这个名字的」，是数据丢失。

## 系统现状

`useDeleteConfigMaps` 接受 namespace 与名称列表。

## 仓库落点

- `apps/console-next/src/pages/configmaps/ClusterConfigMapsPage.tsx`（`onBulkAction`）

## 对外契约

- `DELETE /api/v1/namespaces/:ns/configmaps/:name`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01** — 一次删除请求只属于一个 namespace。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01** — 批量删除的「已选」以名称为键，跨项目时同名会把两条算成一条；选择清空规则必须同时依赖筛选与页码。

## 测试与可观测

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01`

## 后续改进

- 若产品需要跨项目清理，应做成一个独立的「按条件清理」能力，而不是复用批量删除。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DELETE-01`
