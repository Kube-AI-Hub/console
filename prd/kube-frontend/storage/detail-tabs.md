# 存储详情：元数据与事件页签（L3）

[子模块需求](./_index.md)

## 概述

存储卷详情的页签与老 console 对齐：资源状态（属性）、元数据、事件、快照。属性与快照已交付；本页补充元数据与事件，使「为什么这个卷还是 Pending」能在详情内回答。

## 用户故事

### US1 - 在详情里查清原因 (Priority: P2)

作为 **项目成员**，我希望 **在存储卷详情直接看到标签/注解与事件**，以便 **不必为了看一条事件跳到别处**。

**Independent Test**：打开存储卷详情，切到「元数据」看到标签与注解表（条数与对象一致），切到「事件」看到事件表或「还没有事件」说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02** — 已知存在一个快照对象，当打开其详情，则默认停在「数据来源」页签并显示来源声明、快照类型、容量、状态等属性；切到「事件」则显示该快照的事件（类型/原因/消息/次数/最近发生），没有事件时显示「这个对象还没有事件」；两个页签都存在且可切换。
- **AC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01** — 已知存在一个带标签与注解的存储卷，当打开其详情并切到「元数据」，则标签表与注解表的行数分别等于对象 metadata.labels 与 metadata.annotations 的条数，键值原样显示；切到「事件」则显示该 PVC 的事件（类型/原因/消息/次数/最近发生），没有事件时显示「这个对象还没有事件」；四个页签（属性/元数据/事件/快照）都存在且可切换。

## 设计目标

1. 详情内闭环排障：状态、元数据、事件、快照。
2. 元数据只读：编辑走「编辑信息」与「编辑 YAML」，不设第二个编辑器。

## 约束与边界

- 事件读 `/api/v1/namespaces/<ns>/events?fieldSelector=involvedObject.name=…,involvedObject.kind=PersistentVolumeClaim`。
- 快照对象详情有**自己的两个页签**：数据来源（属性）与事件（旧 console 的 `source` / `event` 两个路由）。快照的「为什么没就绪」几乎只写在事件里（驱动报错、VolumeSnapshotClass 缺失），对象自身的 conditions 往往只有一句 `ReadyToUse=false`。

## UI 交互设计

- 页签顺序：属性 → 元数据 → 事件 → 快照。
- 元数据两张表（标签、注解），列为键/值；事件表列为类型/原因/消息/次数/最近发生。

## 文案与校验

- 无标签「没有标签。」、无注解「没有注解。」、无事件「这个对象还没有事件。」

## 边界情况

- 事件接口失败：只该页签显示错误面板与重试，属性仍可用。
- 注解很多（例如 last-applied-configuration）：原样显示并允许换行，不截断隐藏。

## 明确不做

- 元数据就地编辑（走编辑信息/编辑 YAML）。
- 事件排序与筛选（事件数量有限，按 API 返回顺序）。

## 假设

- 事件通过 fieldSelector 过滤受支持（核心 API 支持）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01** — 详情元数据页签与事件页签。

## 成功标准

- **SC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01** — 两个新页签的行数与对象/接口一致，空态明确。

## 验收用例

- TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-01
- TC-L3-KUBE-FRONTEND-STORAGE-DETAIL_TABS-02
