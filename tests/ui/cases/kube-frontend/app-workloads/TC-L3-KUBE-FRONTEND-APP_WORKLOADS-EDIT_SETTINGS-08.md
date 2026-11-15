# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-08 编辑设置：容器组安全上下文与 IP 池

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

编辑设置里的容器组安全上下文（运行用户/用户组/SELinux）与容器组 IP 池选择。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-08** — 已知一个部署没有容器组安全上下文且集群存在可用的 IP 池，当在「编辑设置」里启用容器组安全上下文（禁止以 root 运行、用户 ID 1000、用户组 ID 2000）并选择一个容器组 IP 池后保存，则回读 `spec.template.spec.securityContext` 为 `{runAsNonRoot:true, runAsUser:1000, runAsGroup:2000}`，且容器组模板注解 `cni.projectcalico.org/ipv4pools` 为所选池名的 JSON 数组；取消启用安全上下文后保存，则不再写该块的任何键（apiserver 会把 `securityContext` 规范化为空对象，属服务端默认值）；用户 ID 填非整数时本地拒绝；集群没有 IP 池时不显示该选择器。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-settings.md`](../../../../design/kube-frontend/app-workloads/edit-settings.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在部署详情里改节点选择 (Priority: P1)

作为 **项目运维**，我希望 **在已有部署的「编辑设置」里改选择节点**，以便 **不必改 YAML 就能把 Pod 调度到指定节点**。

**Independent Test**：打开一个部署的详情，点「编辑设置」再点「高级设置」，能看到「选择节点」。

## 前置与配置

- 已登录；项目内可创建部署；集群存在可用 IP 池时验证选择器

## 测试步骤

1. 创建部署并打开「编辑设置」
2. 启用容器组安全上下文（禁止 root、用户 1000、用户组 2000），选择 IP 池后保存
3. 回读 spec.template 的 securityContext 与注解
4. 取消启用安全上下文后保存并回读

## 期望结果

- 用户 ID 非整数时本地拒绝；集群无 IP 池时不显示选择器

## 失败排查

- 安全上下文里的 fsGroup 丢失：整块替换而非合并
- 注解被写成池名字符串而非数组：应写 JSON 数组

## 产品改版后如何更新自动化

- 选择器：deployments-edit:security-context / security-context-enable / security-context-nonroot / security-context-user / security-context-group / ip-pool-select
