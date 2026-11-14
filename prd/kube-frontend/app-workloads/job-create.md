# 任务与定时任务创建（L3）

[子模块需求](./_index.md)

## 概述

项目运维可以创建一次性任务和按计划执行的定时任务。常用策略通过表单配置，完整 Pod 模板在创建前通过 YAML 填写。

## 用户故事

### US1 - 创建项目任务和执行计划 (Priority: P1)

作为 **项目运维**，我希望 **创建任务和定时任务**，以便 **运行一次性处理或定期作业**。

**Independent Test**：创建唯一命名的 Job 和暂停的 CronJob，回读任务策略、镜像和执行计划，结束后删除。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01** — Job/CronJob 列表提供创建入口；表单创建后回读镜像、并行数、完成数和重试次数一致，CronJob 的执行计划、暂停和并发策略一致；通过 YAML 创建可包含完整 Pod 模板，失败在弹窗内显示并保留输入。

## 设计目标

创建前配置不可变的 Job 模板，避免先创建再尝试编辑被 API 拒绝。

## 约束与边界

- 写 batch/v1 的 jobs 和 cronjobs 集合；创建成功不表示任务执行成功。
- Job 重启策略仅 Never/OnFailure；CronJob 的模板位于 spec.jobTemplate.spec。

## UI 交互设计

创建复用 ManifestCreateDialog，表单通过 ResourceForm 渲染。常用数字策略、镜像、重启和拉取策略可填写；
定时任务额外配置执行计划、并发策略、暂停和历史保留数。高级 YAML 原样提交。

## 文案与校验

- `jobCreate.*` 为中英文文案；计数是非负整数，最大运行时间为正整数。
- Cron 表达式由服务端权威校验；无效计划失败时弹窗保持打开。

## 边界情况

- 403、同名冲突、镜像字段错误或计划拒绝均显示在创建弹窗内。
- 暂停 CronJob 不产生新的调度，适合先创建再启用。

## 明确不做

- 不替代任务日志、执行状态及历史记录；不提供修改已创建 Job 的 Pod 模板。

## 假设

- 集群服务 batch/v1，操作者有项目创建权限。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01** — 创建任务和定时任务，支持常用表单及完整 YAML。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01** — API 回读与用户创建配置一致，失败不清空输入。
