# 存储详情：元数据与事件页签 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/storage/detail-tabs.md)

## 概述

`StorageDetailPage.tsx` 的 `MetadataPanel` 与 `EventsPanel`，数据来自详情对象与 `objectEventsApi`。

## 关联需求

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
