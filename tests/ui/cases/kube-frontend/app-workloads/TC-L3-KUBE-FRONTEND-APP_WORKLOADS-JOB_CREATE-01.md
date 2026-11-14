# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01 任务与定时任务创建 · 策略和 YAML 回读

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `job-create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/jobs`
- **需求**: `prd/kube-frontend/app-workloads/job-create.md`

## 产品功能

表单创建 Job、YAML 创建暂停的 CronJob，回读配置不启动测试负载。

### 关联需求

- `prd/kube-frontend/app-workloads/job-create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/job-create.md`](../../../../prd/kube-frontend/app-workloads/job-create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_CREATE-01** — Job/CronJob 列表提供创建入口；表单创建后回读镜像、并行数、完成数和重试次数一致，CronJob 的执行计划、暂停和并发策略一致；通过 YAML 创建可包含完整 Pod 模板，失败在弹窗内显示并保留输入。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/job-create.md`](../../../../design/kube-frontend/app-workloads/job-create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/job-create.md`](../../../../prd/kube-frontend/app-workloads/job-create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 创建项目任务和执行计划 (Priority: P1)

作为 **项目运维**，我希望 **创建任务和定时任务**，以便 **运行一次性处理或定期作业**。

**Independent Test**：创建唯一命名的 Job 和暂停的 CronJob，回读任务策略、镜像和执行计划，结束后删除。

## 前置与配置

- 已登录并有项目创建权限
- 对象使用 uuid 唯一命名，finally 清理；Job parallelism=0，CronJob suspend=true

## 测试步骤

1. 创建 Job，填镜像、并行数 0、重试次数 2，提交后回读
2. 打开定时任务创建并切换 YAML，提交包含 suspend=true 和调度模板的文档
3. 回读执行计划、暂停、并发策略和模板镜像

## 期望结果

- Job 策略数字与镜像匹配表单
- CronJob 配置和嵌套 Pod 模板与 YAML 一致

## 失败排查

- 405 检查是否写错集合，模板位置错误检查 jobTemplate

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py
