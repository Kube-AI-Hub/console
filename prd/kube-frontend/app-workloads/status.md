# 状态派生（L3）

[子模块需求](./_index.md)

## 概述

一项能力：给定负载对象算出列表与详情显示的状态。没有独立控件，从状态徽章观察结果。

## 用户故事

### US1 - 状态与命令行一致 (Priority: P1)

作为 **项目运维**，我希望 **页面状态和 `kubectl` 一致**，以便 **不必怀疑两边哪个对**。

**Independent Test**：对部分就绪的部署，页面应显示「更新中」。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01** — 已知部署 `spec.replicas=3`、`status.readyReplicas=1`，当查看列表，则状态为「更新中」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02** — 已知容器组 `phase=Running` 但有容器 `ready=false`，当查看列表，则状态为「等待中」。

## 设计目标

落实「状态只有一处定义」，并与老 console `utils/status.js` 逐分支一致。

## 约束与边界

- 部署/有状态副本集：`spec.replicas` 与 `status.readyReplicas`。
- 守护进程集：`desiredNumberScheduled` 与 `numberReady`。
- 任务：`failed>0` → 更新中；否则有 `active`/`succeeded` → 运行中。
- 容器组：`Succeeded`/`Failed` → 已终止；`Pending` → 等待中；否则看容器 ready。

## UI 交互设计

不适用（无独立控件）。

## 文案与校验

- 状态文案见应用负载的文案表。

## 边界情况

- 字段缺失时按未知处理：`replicas>0` 无 `readyReplicas` 视为更新中。

## 明确不做

- 不为状态引入新的中间态或自定义颜色。

## 假设

- 对象里的 `status` 由控制器写入，页面只读。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-02`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01** — 每种资源的派生规则与老 console 一致，并由单测逐分支覆盖。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATUS-01** — 单测覆盖每个分支。
