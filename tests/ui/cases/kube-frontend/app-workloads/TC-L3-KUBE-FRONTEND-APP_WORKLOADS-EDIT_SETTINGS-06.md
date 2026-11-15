# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-06 编辑设置：健康检查与优雅终止

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

编辑设置里的三种健康检查（HTTP/TCP/命令）与优雅终止秒数。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-06** — 已知一个部署的容器没有健康检查，当在「编辑设置」里启用存活检查（HTTP，端口 80，路径 `/healthz`，初始延迟 5 秒）并把优雅终止设为 45 秒后保存，则回读该容器的 `livenessProbe.httpGet` 为 `{path:/healthz, port:80}` 且 `initialDelaySeconds=5`，`spec.template.spec.terminationGracePeriodSeconds=45`；取消启用后保存，则 `livenessProbe` 被移除；检查方式切到「命令」并留空命令时本地拒绝，端口填 70000 时本地拒绝；优雅终止填非整数时本地拒绝。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-settings.md`](../../../../design/kube-frontend/app-workloads/edit-settings.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在部署详情里改节点选择 (Priority: P1)

作为 **项目运维**，我希望 **在已有部署的「编辑设置」里改选择节点**，以便 **不必改 YAML 就能把 Pod 调度到指定节点**。

**Independent Test**：打开一个部署的详情，点「编辑设置」再点「高级设置」，能看到「选择节点」。

## 前置与配置

- 已登录且项目内可创建部署

## 测试步骤

1. 创建部署并打开「编辑设置」
2. 启用存活检查（HTTP、端口 80、路径 /healthz、初始延迟 5），填写优雅终止 45
3. 保存并回读 spec.template
4. 再次打开，取消启用存活检查并保存，回读

## 期望结果

- 命令方式留空、端口 70000、优雅终止非整数时本地拒绝

## 失败排查

- 回读多出 timeoutSeconds/periodSeconds：服务端默认值，属正常
- 探针被写成空对象：未启用时应删除该键

## 产品改版后如何更新自动化

- 选择器：deployments-edit:probes / probe-enable:<kind> / probe-type:<kind> / probe-port:<kind> / probe-path:<kind> / grace-period-input
