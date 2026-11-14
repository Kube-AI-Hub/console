# 任务与定时任务创建（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/job-create.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01

## 概述

JobCreateDialog 提供任务策略 schema，纯函数 jobManifest 构造 batch/v1 文档。
与网络资源共用 ManifestCreateDialog，完整 YAML 不经表单映射裁剪。

## 系统现状

老版 JobSettings 配置并行数、完成数与重试；新 UI 原来只开放三个控制器创建。
本轮开放 Job/CronJob 并提供创建前 YAML，保留不可变模板的高级字段。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/{JobCreateDialog,jobManifest,WorkloadListPage,queries}`
- `apps/console-next/src/components/resource/ManifestCreateDialog.tsx`
- `packages/api-client/src/workloads.ts`

## 对外契约

POST `/apis/batch/v1/namespaces/<ns>/{jobs,cronjobs}`，body 使用 Job/CronJob 与 batch/v1。
目标项目必须与 metadata.namespace 一致，创建句柄为 `<kind>:create`、`<kind>:create-yaml-submit`。

## 设计目标与非目标

目标：可靠创建，统一表单与 YAML 交互。非目标：Job 模板编辑、重跑和定时任务执行记录。

## 关键约束

- Job 模板位于 spec.template；CronJob 位于 spec.jobTemplate.spec.template，不得混用。
- 创建前校验非负整数和必填字段，cron 表达式由上游最终校验。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01 — 表单与 YAML 外壳共享，任务规格单独映射

**为什么**：网络资源已需要同一套表单、YAML、提交反馈；第二个使用者出现后上收交互外壳。
任务数字、restartPolicy 与 jobTemplate 路径属于业务，仍在独立映射函数中。

**被否方案**：复用 Deployment 的 apps/v1 创建接口；产生错误资源种类和路径。只提供简易表单，会让 Job 无法配置创建后不可变的模板字段。

**何时重新考虑**：模板向导成为高频需求时增加可复用的容器/存储配置 schema。

## 不变量

1. CronJob 任务配置只写入 jobTemplate，重启策略不允许 Always。
2. YAML 额外字段保持原样，提交失败不关闭弹窗。
3. 创建成功刷新对应资源列表，不以本地缓存伪装保存成功。

## 已知坑

- Job spec.template 创建后通常不可变；高级配置必须在创建之前完成。
- CronJob 的暂停只阻止后续调度，不停止已经创建的 Job。

## 测试与可观测

E2E 见 `tests/kube-frontend/app-workloads/`，回读表单 Job 与 YAML CronJob，finally 删除唯一对象。
单测覆盖嵌套模板路径与零值计数，创建接口由 API 契约测试检查集合 POST。

## 后续改进

执行记录及任务重跑仍按独立功能点核对，不因创建入口出现就标记全部完成。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01`
