# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-07 编辑设置：存储挂载

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-settings`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-settings.md`

## 产品功能

编辑设置里的卷定义（临时卷/节点路径/持久卷声明/配置字典/保密字典）与容器挂载点。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-settings.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-settings.md`](../../../../prd/kube-frontend/app-workloads/edit-settings.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-07** — 已知一个部署没有存储卷，当在「编辑设置」的存储挂载里新增一个临时卷（名称 `data`）并在容器上挂载到 `/data`，则回读 `spec.template.spec.volumes` 含 `{name:data, emptyDir:{}}`、该容器的 `volumeMounts` 含 `{name:data, mountPath:/data}`；把卷类型改为持久卷声明并填写声明名后保存，则卷来源变为 `persistentVolumeClaim.claimName`；卷名非法（含大写或下划线）、卷名重复、持久卷声明类型缺来源、挂载路径非绝对路径或同一容器内重复时本地拒绝；删除卷后保存，则该卷与其挂载一起消失。

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
2. 新增临时卷 data，并在容器上挂载到 /data，保存后回读
3. 把卷类型改为持久卷声明、填写声明名后保存并回读
4. 删除卷后保存并回读

## 期望结果

- 卷名非法/重复、缺来源、挂载路径非绝对或重复时本地拒绝

## 失败排查

- 422：emptyDir 写成空字符串或卷名含大写
- 挂载未生效：volumeMounts 的 name 与 volumes 的 name 不一致

## 产品改版后如何更新自动化

- 选择器：deployments-edit:volumes / volume-add / volume-name:<id> / volume-type:<id> / volume-source:<id> / mounts / mount-add / mount-path:<id>
