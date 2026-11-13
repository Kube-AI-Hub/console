# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_RUNS-01 任务详情 · 执行记录

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_RUNS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `job-runs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/jobs`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

任务详情列出其每次执行的容器组（序号、名称、状态、退出码、开始/结束时间），序号从 1 递增。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_RUNS-01** — 已知一个任务启动过容器组，当打开其详情，则显示「执行记录」表（序号、容器组名称、状态、退出码、开始时间、结束时间），序号从 1 起按创建时间递增。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由夹具创建一个正常结束的 tc-e2e- 任务并等待其完成，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该任务详情
2. 读取执行记录表

## 期望结果

- 表头为 序号、容器组名称、状态、退出码、开始时间、结束时间
- 至少一行，序号从 1 开始
- 状态为 Succeeded，退出码为 0

## 失败排查

- 区块不出现说明该任务的 Pod 已被受控清理（ttlSecondsAfterFinished 或历史清理）
- 序号不从 1 开始说明排序用了完成时间而非创建时间

## 产品改版后如何更新自动化

- 字段变化时改 api-client 的 toJobRun
