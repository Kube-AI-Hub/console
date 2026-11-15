# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03 编辑设置：容器资源限额

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

部署详情「编辑设置」里的容器 CPU/内存请求与上限，写入 resources.requests/limits 并可清空。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03** — 已知一个部署的容器没有设置资源限额，当在「编辑设置」里为容器填写 CPU/内存的请求与上限并保存，则回读该部署的 `spec.template.spec.containers[].resources` 中 requests/limits 与填写一致；只填请求不填上限时只写 requests；全部留空时 `resources` 字段被移除；请求大于上限或数量写法不合法（例如 `abc`）时在本地拒绝并说明原因，不发请求。

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

1. 创建一个无资源限额的部署并打开详情
2. 打开「编辑设置」，填写 CPU/内存请求与上限并保存
3. 回读 spec.template.spec.containers[0].resources
4. 再打开编辑设置，把四个字段清空后保存并回读

## 期望结果

- 请求大于上限时本地拒绝且不发请求

## 失败排查

- 422：数量写法非法或请求大于上限
- resources 仍存在但为空对象：清空逻辑未删除字段

## 产品改版后如何更新自动化

- 选择器：deployments-detail:edit-settings / deployments-edit:cpu-request / :cpu-limit / :memory-request / :memory-limit / :submit
