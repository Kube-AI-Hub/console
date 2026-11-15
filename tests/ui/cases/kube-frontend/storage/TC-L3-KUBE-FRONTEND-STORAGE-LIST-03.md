# TC-L3-KUBE-FRONTEND-STORAGE-LIST-03 存储卷列表的持久卷列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-LIST-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

存储卷列表显示「持久卷」列并链接到该 PV 的详情页。

### 关联需求

- `prd/kube-frontend/storage/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-STORAGE-LIST-03** — 已知存储卷列表有数据，当对一行点「编辑信息」并填写别名，则对象的 `kubesphere.io/alias-name` 注解被更新，列表显示该别名。

### 关联设计

- 技术方案 [`design/kube-frontend/storage/list.md`](../../../../design/kube-frontend/storage/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/storage/list.md`](../../../../prd/kube-frontend/storage/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些存储卷、是否绑定 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到绑定状态、容量与访问模式**，以便 **判断有没有卷没绑上**。

**Independent Test**：打开 `…/projects/<ns>/persistentvolumeclaims`，核对五列与状态徽章。

## 前置与配置

- 已登录；项目内至少有一个已绑定的存储卷

## 测试步骤

1. 打开存储卷列表
2. 找到已绑定的行，核对持久卷列与其链接

## 期望结果

- 快照列表不显示该列

## 失败排查

- 列为空：summary 未映射 volumeName

## 产品改版后如何更新自动化

- 选择器：persistentvolumeclaims:volume:<pv>
