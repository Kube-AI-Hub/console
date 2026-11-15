# TC-L3-KUBE-FRONTEND-STORAGE-CREATE-02 从快照创建存储卷

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-CREATE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/create.md`

## 产品功能

创建存储卷弹窗的「从快照创建」分支：隐藏存储类型、显示快照选择，无就绪快照时说明原因。

### 关联需求

- `prd/kube-frontend/storage/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/create.md`](../../../../prd/kube-frontend/storage/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-CREATE-02** — 已知创建方式切到「从快照创建」，当选择快照并提交，则请求的 spec.dataSource 指向该 VolumeSnapshot 且不带 storageClassName；项目内没有就绪快照时给出「还没有就绪的快照」说明，而不是空下拉。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/create.md`](../../../../design/kube-frontend/storage/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/create.md`](../../../../prd/kube-frontend/storage/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一次填完就能用 (Priority: P1)

作为 **项目成员**，我希望 **在列表上直接创建存储卷，并看到存储类型支持的模式与容量范围**，以便 **一次提交就得到能挂载的卷，而不是先建错再改**。

**Independent Test**：在项目存储卷列表点「创建存储卷」，填写名称与容量后提交，回读该 PVC 的 spec（存储类型、访问模式、容量）与表单一致；切换为「从快照创建」时存储类型字段消失并出现快照选择。

## 前置与配置

- 已登录且可读项目快照

## 测试步骤

1. 打开创建存储卷弹窗
2. 把创建方式切到「从快照创建」
3. 观察存储类型字段与快照字段

## 期望结果

- 该分支不发送 storageClassName

## 失败排查

- 仍显示存储类型：创建方式未切换
- 空下拉：应显示说明而不是空列表

## 产品改版后如何更新自动化

- 选择器：storage-create:method / storage-create:no-snapshot / storage-create:snapshot
