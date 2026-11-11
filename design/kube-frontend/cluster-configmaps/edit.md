# 编辑配置字典（集群级）· 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/edit.md`](../../../prd/kube-frontend/cluster-configmaps/edit.md)。

## 概述

三个编辑入口的写路径选择，以及跨项目列表下如何定位对象。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01`

## 设计目标与非目标

**目标**：写请求永远指向对象自己的项目。

**非目标**：不实现改名称或迁移项目。

## 关键约束

- 编辑信息用 merge patch；编辑设置与编辑 YAML 用「先读后整体 PUT」。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01 — 写操作的 namespace 来自行，不来自筛选器

**为什么**：列表跨项目时筛选器是「全部项目」，此时它没有可用的 namespace。`useConfigMapListController` 在打开弹窗前先 `setTarget(row)`，把这个对象的 `(namespace, name)` 交给三个 mutation。

**被否方案**：从路由或筛选器推导 namespace。跨项目视图下推导不出，且同名对象会写到错误的目标。

## 系统现状

三个弹窗组件与项目级共用，`update` / `patch` 接受显式 namespace。

## 仓库落点

- `apps/console-next/src/pages/configmaps/controller.ts`（`target` / `setTarget` / `loadDetail`）

## 对外契约

- `PATCH /api/v1/namespaces/:ns/configmaps/:name`（merge patch）
- `GET .../namespaces/:ns/configmaps/:name` 后 `PUT /api/v1/namespaces/:ns/configmaps/:name`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01** — 写路径里的 namespace 等于被编辑对象的 namespace。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-02** — 列表汇总不含 `data`，编辑前必须读详情；用汇总对象保存会把数据覆盖成空。

## 测试与可观测

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01`：项目 A 的对象被改，项目 B 的同名对象不变。

## 后续改进

- 若服务端支持 server-side apply，可去掉先读后写。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-EDIT-01`
