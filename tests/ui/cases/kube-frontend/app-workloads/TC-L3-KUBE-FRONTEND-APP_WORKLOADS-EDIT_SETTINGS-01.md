# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01 编辑设置 · 部署可改节点，任务只改策略

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

老 console 的部署「编辑设置」含「选择节点」；任务「编辑设置」含「最大重试次数」且不含「选择节点」；容器组详情没有「编辑设置」。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01** — 已知一个部署已存在，当打开其详情并进入「编辑设置」的「高级设置」，则出现「选择节点」。
- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-02** — 已知一个任务已存在，当打开其「编辑设置」，则出现「最大重试次数」，且不出现「选择节点」。已知打开一个容器组详情，则操作里没有「编辑设置」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-settings.md`](../../../../design/kube-frontend/app-workloads/edit-settings.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在部署详情里改节点选择 (Priority: P1)

作为 **项目运维**，我希望 **在已有部署的「编辑设置」里改选择节点**，以便 **不必改 YAML 就能把 Pod 调度到指定节点**。

**Independent Test**：打开一个部署的详情，点「编辑设置」再点「高级设置」，能看到「选择节点」。

### US2 - 任务编辑不包含不可改的 Pod 模板 (Priority: P1)

作为 **项目运维**，我希望 **任务的「编辑设置」只出现可更新的策略**，以便 **不会提交一个会被集群拒绝的节点或容器修改**。

**Independent Test**：打开一个任务的详情，点「编辑设置」，能看到最大重试次数，看不到「选择节点」。容器组详情没有「编辑设置」。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- 用例自行创建并在结束后删除一个部署、一个任务和一个容器组

## 测试步骤

1. 打开该部署在老 console 的资源状态页，从「更多」进入「编辑设置」，再打开「高级设置」
2. 打开该任务在老 console 的详情，从「更多」进入「编辑设置」
3. 打开该容器组在老 console 的详情，打开「更多」

## 期望结果

- 部署编辑弹窗可见「选择节点」
- 任务编辑弹窗可见「最大重试次数」，且不可见「选择节点」
- 容器组详情的操作菜单没有「编辑设置」

## 失败排查

- 页签缺失时先确认打开的是老 console 路径 /clusters/...，不是 /kube-frontend/...
- 线上镜像未包含本次构建时，部署编辑弹窗还没有「高级设置」

## 产品改版后如何更新自动化

- 文案变化时改本用例的可见文本
