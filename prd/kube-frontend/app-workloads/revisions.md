# 版本历史与回滚（L3）

[子模块需求](./_index.md)

## 概述

部署详情列出各版本：版本号、镜像、副本数、创建时间与回滚操作。当前版本带标记且不提供回滚。

## 用户故事

### US1 - 把部署退回上一个可用版本 (Priority: P1)

作为 **应用运维**，我希望 **看到历史版本并一键回退**，以便 **在发布出问题时尽快恢复**。

**Independent Test**：打开一个有多次改动的部署详情，核对版本表与回滚结果。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01** — 已知一个部署有三次改动形成的三个版本，当打开详情，则版本表按版本号降序、只有最新版本带「当前」标记且它没有回滚按钮；当对版本 1 回滚并确认，则容器镜像恢复为版本 1 的镜像。

## 设计目标

1. 让"当前在哪个版本"与"能退回哪里"一眼分明。
2. 回滚不破坏历史：回滚后应产生新的版本记录，而不是抹掉原有记录。

## 约束与边界

- 版本来自 Deployment 拥有的 ReplicaSet，版本号取注解 `deployment.kubernetes.io/revision`。
- 仅 Deployment 有版本历史；有状态副本集与守护进程集没有。

## UI 交互设计

表格五列；当前版本行在版本号后带「当前」小徽标，操作列为空。

## 文案与校验

- 列：版本、容器镜像、副本、创建时间、操作。
- 动作：回滚（仅非当前版本）。

## 边界情况

- 版本注解缺失时版本号按 0 显示，排序仍按创建时间兜底。
- 只有一个版本时不显示回滚按钮。

## 明确不做

- 版本之间的差异对比（diff）。
- 指定副本数与镜像的"再次部署"。

## 假设

- 部署保留历史 ReplicaSet（`revisionHistoryLimit` 未设为 0）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01** — 版本表按版本号降序，标记当前版本。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-02** — 回滚把模板恢复为选定版本。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-REVISIONS-01** — 回滚后容器镜像等于目标版本的镜像。
