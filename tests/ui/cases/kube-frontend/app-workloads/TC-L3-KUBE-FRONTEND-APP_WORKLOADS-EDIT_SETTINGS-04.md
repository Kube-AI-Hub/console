# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04 编辑设置：更新策略

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

部署/有状态副本集/守护进程集的更新策略（滚动/同时更新/手动更新）与滚动参数。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04** — 已知一个部署（有状态副本集/守护进程集同理），当在「编辑设置」里把更新策略改为「同时更新」（有状态副本集/守护进程集为「手动更新」）并保存，则回读 `spec.strategy.type`（有状态副本集与守护进程集为 `spec.updateStrategy.type`）为该值且 `rollingUpdate` 字段被移除；改回「滚动更新」并填写最大不可用/最大超出（有状态副本集为分区）后保存，则回读 `rollingUpdate` 与填写一致；百分比或整数以外的值在本地拒绝。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-settings.md`](../../../../design/kube-frontend/app-workloads/edit-settings.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在部署详情里改节点选择 (Priority: P1)

作为 **项目运维**，我希望 **在已有部署的「编辑设置」里改选择节点**，以便 **不必改 YAML 就能把 Pod 调度到指定节点**。

**Independent Test**：打开一个部署的详情，点「编辑设置」再点「高级设置」，能看到「选择节点」。

## 前置与配置

- 已登录且项目内可创建部署与有状态副本集

## 测试步骤

1. 打开部署的「编辑设置」，把策略改为「同时更新（重建）」并保存，回读 spec.strategy
2. 再改回「滚动更新」，填写最大超出后保存并回读 rollingUpdate
3. 对创建的有状态副本集改策略为「手动更新」并回读 spec.updateStrategy

## 期望结果

- 非百分比/非整数在本地拒绝

## 失败排查

- 策略没变：服务端默认 RollingUpdate，diff 不出现策略行属正常
- 字段写到 strategy 而非 updateStrategy：kind 映射错误

## 产品改版后如何更新自动化

- 选择器：deployments-edit:strategy / :strategy-type / :strategy-max-surge / :strategy-max-unavailable / :strategy-partition
