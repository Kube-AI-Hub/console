# 存储详情：元数据与事件页签 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/detail-tabs.md)

## 概述

`StorageDetailPage.tsx` 的 `MetadataPanel` 与 `EventsPanel`，数据来自详情对象与 `objectEventsApi`。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02
- AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01

## 设计目标与非目标

目标：详情内可排障。非目标：元数据编辑、事件筛选。

## 关键约束

- 事件按 involvedObject 过滤，kind 用 PersistentVolumeClaim / VolumeSnapshot。
- 属性页签已有 provisioner/创建者等字段，新页签只加不重复。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01 — 元数据只读，编辑仍走两个既有入口

**为什么**：编辑信息改别名/描述，编辑 YAML 改其余注解；再加一个元数据编辑器会让同一份注解有三个写入路径，冲突时无法判断以谁为准。

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02 — 事件页签独立请求，失败只降级本页签

**为什么**：事件接口失败不应让属性与快照一起消失；独立查询让每个页签自己的三态成立。

## 系统现状

老 console 详情有 resource-status/metadata/events/snapshot 四个页签；新 UI 此前只有属性与快照。

## 仓库落点

- 页面：`apps/console-next/src/pages/storage/StorageDetailPage.tsx`
- 数据：`apps/console-next/src/pages/storage/queries.ts`（useObjectEvents）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 对象事件 | GET /api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=<name>,involvedObject.kind=<kind> |

## 不变量

1. 元数据页签只读。
2. 事件为空与事件失败分开表达。

## 已知坑

- kapis 忽略 fieldSelector，事件必须走核心 API（`/api/v1/.../events`）。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/storage/TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01.yaml`
句柄：storage-detail:tab:metadata/events、storage-detail:labels/annotations、storage-detail:events/events-empty/events-retry

## 后续改进

- 事件按时间倒序与分页。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01

### DEC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02 — 快照详情补回「数据来源 / 事件」两个页签

**为什么**：旧 console 的快照详情就是这两个页签（`VolumeSnapshots/Detail/routes.js` 的 `source` 与 `event`，默认 `source`）。新 UI 第一版把快照详情做成单列，理由写的是「其元数据由快照页签与 YAML 覆盖」——但被去掉的是**事件**，不是元数据。快照最常见的状态是「容量有了但 `readyToUse` 一直 false」，原因几乎只出现在事件里（驱动报错、VolumeSnapshotClass 不存在、快照控制器没装），对象自身的 conditions 只有一句 `ReadyToUse=false`。把事件藏起来，等于让人去猜。

**实现**：事件查询本来就是按 kind 取的（`useObjectEvents` 对快照用 `VolumeSnapshot`），数据已经在手，只是没有落点；补页签不增加请求。

**被否方案**：在单列里直接追加一个「事件」区块。页签是使用场景——数据来源是「这个快照是什么」，事件是「它为什么没成」；两者同屏反而让人先读属性再翻事件。旧页的页签顺序也保住了肌肉记忆。

**何时重新考虑**：快照详情增加「恢复/克隆」这类写操作时，页签集合要重新评估（写操作需要独立入口）。

