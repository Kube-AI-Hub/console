# 容器组事件（L3）

[子模块需求](./_index.md)

## 概述

容器组详情里的「事件」区块：该 Pod 相关的 Kubernetes 事件（类型、原因、消息、来源、次数、最近时间），按时间倒序。

老 console 把它放在容器组详情的「资源状态」页签里。事件是「为什么起不来」的第一现场：镜像拉取失败、调度失败、探针失败都只在这里留下痕迹。

## 用户故事

### US1 - 这个容器组为什么起不来 (Priority: P1)

作为 **项目成员**，我希望 **在容器组详情看到该 Pod 的事件**，以便 **不必去命令行敲 `kubectl describe` 就能知道失败原因**。

**Independent Test**：打开一个有事件的 Pod 详情，核对事件条数等于该 Pod 的 events 接口返回条数。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01** — 已知某容器组有事件，当打开其详情，则「事件」区块按时间倒序列出每条事件的类型、原因、消息、来源、重复次数与最近时间；条数等于 `events` 接口以 `involvedObject.name=<pod>,involvedObject.kind=Pod` 过滤后的条数；没有事件时显示说明；事件读取失败时只该区块降级。

## 设计目标

1. 倒序：最近发生的事在最上面。
2. 保留重复次数（`x2343` 与发生一次是两种问题）。

## 约束与边界

- 只读；数据来自核心 API 的 events，按 fieldSelector 过滤。
- 仅容器组详情展示（控制器的模板没有事件）。

## UI 交互设计

- 每条：类型徽标（Warning 用警示色）+ 原因 + 消息 + 「来源 · 次数 · 时间」。

## 文案与校验

- 空态：没有记录到事件。
- 读取失败：事件不可用。

## 边界情况

- `count` 缺省按 1 处理。
- `lastTimestamp` / `eventTime` / `firstTimestamp` 都缺失时时间显示 `-`。

## 明确不做

- 事件全文检索（工具箱的独立功能）。
- 事件删除/归档。

## 假设

- 事件对象以 `involvedObject` 指向 Pod，且可按该字段过滤。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01** — 按 Pod 读事件并倒序展示。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-02** — 无事件/读取失败各自给出说明。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-POD_EVENTS-01** — 条数与接口一致；最近时间与接口最新一条一致。