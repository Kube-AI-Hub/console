# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05 编辑设置：选择节点与容器组标签注解

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

编辑设置的高级设置：节点选择、容器组标签与注解；容器组标签必须保留选择器依赖的标签。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05** — 已知一个部署已存在且其选择器为 `app=<name>`，当在「编辑设置」的高级设置里新增节点选择（`kubernetes.io/os=linux`）与容器组注解（`prometheus.io/scrape=true`）并保存，则回读 `spec.template.spec.nodeSelector` 与 `spec.template.metadata.annotations` 与填写一致；当移除容器组标签中「选择器依赖的标签」时，页面给出说明并禁用保存且不发请求；把选择器依赖的标签保留、另加一条新标签后保存，则回读的容器组标签同时包含两者；节点选择留空时该字段被移除。

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
2. 移除容器组标签中选择器依赖的标签，观察保存状态
3. 恢复该标签、新增一条标签与一条注解、添加节点选择后保存
4. 回读 spec.template 的 labels/annotations 与 spec.template.spec.nodeSelector

## 期望结果

- 键重复或格式非法时本地拒绝

## 失败排查

- 422 immutable：选择器依赖的标签被改动
- 字段未写入：路径按 kind 取错（cronjobs 在 jobTemplate 下）

## 产品改版后如何更新自动化

- 选择器：deployments-edit:advanced / edit-settings:node-selector-* / edit-settings:pod-labels-* / edit-settings:pod-annotations-* / deployments-edit:selector-error
