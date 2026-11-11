# 集群配置字典列表 · 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/list.md`](../../../prd/kube-frontend/cluster-configmaps/list.md)。

## 概述

跨项目列表的实现：数据来源选择、列定义、项目筛选与排序。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01`
- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02`

## 设计目标与非目标

**目标**：与项目级共用列表状态机，只替换数据来源、列与筛选默认值。

**非目标**：不做列自定义，不做多项目多选筛选。

## 关键约束

- 状态与文案分离；列定义是数据。
- `data-ai-state` 恰好一个，位于 `cluster-configmaps:surface`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01 — 共享 `useConfigMapListController`

**为什么**：分页、搜索防抖、排序循环、选择清空、四个 mutation、`loadDetail` 在两个页面完全一致。抽到 `pages/configmaps/controller.ts`，由 `scope` 决定初始筛选与读端点；页面只保留列与 `onAction`。

**被否方案**：两个页面各写一份。第一次修「切页清空选择」就要改两处，第二处会忘。

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02 — 「项目」列不折叠

**为什么**：ConfigMap 名称只在项目内唯一。折叠「项目」列后，两个同名对象在手机上是两行无法区分的数据，「删除」就成了赌博。

**被否方案**：沿用项目级的 `hideBelow` 策略。项目级没有这一列，所以之前不需要这个判断。

## 系统现状

项目级页面已把 schema 列表跑通；本页复用 `ResourceList`，只在 `columns` 上分叉。

## 仓库落点

- `apps/console-next/src/pages/configmaps/ClusterConfigMapsPage.tsx`
- `apps/console-next/src/pages/configmaps/controller.ts`
- `packages/api-client/src/configmaps.ts`（`scope`）

## 对外契约

- 读：`GET /kapis/resources.kubesphere.io/v1alpha3/configmaps?page&limit&sortBy&ascending&name`
- 收窄到一个项目时：`.../clusters/:c/namespaces/:ns/configmaps`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01** — 查询键包含 `scope`，不同作用域的缓存不互相覆盖。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01** — 跨项目集合在数千条时比单项目查询慢一个量级；页面必须能显示骨架而不是卡住。

## 测试与可观测

- `test/cluster-configmaps-page.test.tsx`：列顺序、跨项目行、「项目」列不折叠。
- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01/02`。

## 后续改进

- 若服务端支持按多个命名空间过滤，项目筛选可扩展为多选。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02`
