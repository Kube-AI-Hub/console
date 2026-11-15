# TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01 创建存储卷（新建）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/create.md`

## 产品功能

存储卷列表的主操作「创建存储卷」按存储类型创建 PVC。

### 关联需求

- `prd/kube-frontend/storage/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/create.md`](../../../../prd/kube-frontend/storage/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE-01** — 已知项目内存在存储类型（含集群默认类型），当在存储卷列表点「创建存储卷」并提交名称、存储类型、访问模式与容量，则创建出对应的 PersistentVolumeClaim，回读 spec.storageClassName、spec.accessModes、spec.resources.requests.storage 与表单一致，列表出现该行；存储类型留空时请求不带 storageClassName（由集群默认类型决定）；访问模式选项来自所选存储类型声明的支持模式，未声明时给出 Kubernetes 的四种模式；容量超出该类型声明的范围时在本地拒绝并说明范围。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/create.md`](../../../../design/kube-frontend/storage/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/create.md`](../../../../prd/kube-frontend/storage/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一次填完就能用 (Priority: P1)

作为 **项目成员**，我希望 **在列表上直接创建存储卷，并看到存储类型支持的模式与容量范围**，以便 **一次提交就得到能挂载的卷，而不是先建错再改**。

**Independent Test**：在项目存储卷列表点「创建存储卷」，填写名称与容量后提交，回读该 PVC 的 spec（存储类型、访问模式、容量）与表单一致；切换为「从快照创建」时存储类型字段消失并出现快照选择。

## 前置与配置

- 已登录且项目内至少有一个存储类型

## 测试步骤

1. 打开项目存储卷列表
2. 点「创建存储卷」，核对默认存储类型与访问模式选项
3. 填写唯一名称与容量并提交
4. 回读该 PVC 的 spec 并核对列表

## 期望结果

- 超出范围的容量在本地被拒绝

## 失败排查

- 提交后对象 Pending：WaitForFirstConsumer 类型属正常
- 422：访问模式与存储类型不匹配

## 产品改版后如何更新自动化

- 选择器：persistentvolumeclaims:create / storage-create:name / storage-create:storage-class / storage-create:size / storage-create:submit
