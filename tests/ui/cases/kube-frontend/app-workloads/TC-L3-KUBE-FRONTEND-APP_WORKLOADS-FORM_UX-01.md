# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01 表单 · 校验聚焦与提交失败提示

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `form-ux`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

提交被校验拦下时焦点落到第一个错误字段；提交被服务端拒绝时对话框内显示原因并保留输入。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-FORM_UX-01** — 已知创建表单有必填字段，当在未填写时提交，则焦点移到第一个未通过校验的字段；当提交被服务端拒绝（例如同名对象已存在），则对话框保持打开、在表单内显示失败原因，且用户已填内容不被清空。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具先创建一个已存在的部署（名字将被复用），用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开创建对话框，直接点确认
2. 读取当前焦点元素
3. 填写与既有部署同名的名称并提交
4. 读取表单错误区与名称输入框

## 期望结果

- 焦点在名称字段（ai-field-name）
- 对话框保持打开，错误区显示「already exists」类原因
- 名称输入框仍保留用户填写的值

## 失败排查

- 无错误区说明异常未被 ResourceForm 捕获（会变成 unhandled rejection）
- 对话框关闭说明失败路径错误地调用了关闭

## 产品改版后如何更新自动化

- ResourceForm 的提交行为变化时改 packages/ai-kit 及其单测
