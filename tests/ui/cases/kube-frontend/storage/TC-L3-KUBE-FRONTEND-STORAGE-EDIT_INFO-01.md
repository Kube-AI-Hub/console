# TC-L3-KUBE-FRONTEND-STORAGE-EDIT_INFO-01 存储 · 编辑信息写入别名

- **用例 ID**: `TC-L3-KUBE-FRONTEND-STORAGE-EDIT_INFO-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `storage` `edit-info`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/persistentvolumeclaims`
- **需求**: `prd/kube-frontend/storage/list.md`

## 产品功能

在存储卷列表点「编辑信息」填写别名后，对象的 kubesphere.io/alias-name 注解被更新。

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

- 由夹具创建一个 tc-e2e- 前缀的存储卷，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开列表并按名称定位该对象
2. 行操作点「编辑信息」
3. 在别名输入框填写内容并确认
4. 用 API 读取该对象的注解

## 期望结果

- 弹出编辑信息对话框且名称只读
- 确认后对话框关闭
- kubesphere.io/alias-name 等于填写的内容

## 失败排查

- 若 PUT 返回 405，说明更新请求发到了集合地址（body.metadata.name 缺失）
- 若注解未变化，先看是否为模板对象的写保护

## 产品改版后如何更新自动化

- 对话框字段变化时改 pages/storage.py
