# TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03 应用负载 · 创建部署与名称校验

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-APP_WORKLOADS-03`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `app-workloads` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

列表头部「创建」打开表单，填写名称/镜像/副本数即可创建；非法名称被拦下。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-APP_WORKLOADS-05** — 已知在部署列表，当点「创建」并填写名称、镜像与副本数后提交，则对象被创建，其 `spec.replicas` 与容器镜像与填写内容一致；名称不符合 Kubernetes 命名规则时提交被拦下并给出提示。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例自行创建的部署在结束时无条件删除

## 测试步骤

1. 打开部署列表并点「创建」
2. 输入非法名称（含大写），点确认
3. 改为合法名称与镜像、副本数 2，点确认
4. 用 API 核对对象

## 期望结果

- 点「创建」后表单出现且名称为空
- 非法名称时提交被拦下并提示
- 提交后对象存在，replicas 为 2，镜像等于填写值

## 失败排查

- 表单不出现时确认创建按钮是 primaryAction 而不是批量操作
- 提交无响应时看表单校验是否把必填字段判空

## 产品改版后如何更新自动化

- 字段变化时改 pages/app_workloads.py
