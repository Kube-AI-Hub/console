# 集群日志收集（L3）

[子模块需求](./_index.md)

## 概述

日志能否落库由四个对象决定：收集器（FluentBit）、它的配置、输入（tail 哪些源）与输出（写到哪）。本页只读地摊开这四件事。

收集器 CR 在本集群的 `status` 是空对象（实测），所以「是否真的在跑」由收集器自有的 Pod 回答——这也是运维用 kubectl 看的那一眼。

## 用户故事

### US1 - 确认日志真的在收集 (Priority: P1)

作为 **集群管理员**，我希望 **看到收集器是否在运行、有哪些输入与输出**，以便 **排查「日志查不到」是采集没起来还是输出没配上**。

**Independent Test**：打开日志收集页，核对就绪 Pod 数等于 `app.kubernetes.io/name=fluent-bit` 的 Pod 中 Running 数；输入/输出条数等于 CR 条数。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 已知集群部署了日志收集，当打开集群日志收集页，则收集器显示名称、命名空间、配置、镜像与「就绪 Pod x/y」；输入区逐条列出名称与插件/标签；输出区逐条列出名称、插件、目标地址与 match；三区条数分别等于 fluentbits / inputs / outputs 的 CR 条数；未部署时显示空态。

## 设计目标

1. 一屏回答「采集是否在跑、收什么、写哪」。
2. 只读：改管道需要专门的编辑流程与校验，不在本页。

## 约束与边界

- 读 `/apis/logging.kubesphere.io/v1alpha2/{fluentbits,inputs,outputs}`（kapis 下无对应聚合，实测 404）。
- 收集器 Pod 读核心 API（按标签）。

## UI 交互设计

- 三段：收集器（含就绪 Pod 徽标）、输入、输出。
- 输出行显示 host + match，便于判断「这条管道收哪类日志」。

## 文案与校验

- 空态：没有部署日志收集器 / 没有配置日志输入 / 没有配置日志输出。
- 状态未知：未知。

## 边界情况

- 收集器 `status` 为空：不显示伪状态，改用 Pod 就绪数。
- Pod 读不到：徽标显示「未知」，其余区块照常。

## 明确不做

- 修改收集器/输入/输出：需要专门的编辑与校验流程。
- 日志全文检索：属工具箱，单独规划。

## 假设

- 日志组件由 `logging.kubesphere.io` 的 CR 描述，且核心 API 可读其 Pod。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 展示收集器与其就绪 Pod 数。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-02** — 展示输入与输出清单。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_COLLECTIONS-01** — 三区条数与 CR 一致；就绪 Pod 数与 Running 数一致。