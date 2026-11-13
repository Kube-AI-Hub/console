# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01 编辑 YAML · 预填对象并原样保存

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-yaml`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-yaml.md`

## 产品功能

详情页的「编辑 YAML」打开预填当前对象的编辑器，名称锁定；原样保存后对话框关闭。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-yaml.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-yaml.md`](../../../../prd/kube-frontend/app-workloads/edit-yaml.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_YAML-01** — 已知在部署详情，当编辑 YAML 并保存，则对象被更新，且名称不可修改。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-yaml.md`](../../../../design/kube-frontend/app-workloads/edit-yaml.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-yaml.md`](../../../../prd/kube-frontend/app-workloads/edit-yaml.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 用 YAML 改一处配置 (Priority: P1)

作为 **项目运维**，我希望 **直接编辑对象 YAML 并保存**，以便 **改列表没暴露的字段**。

**Independent Test**：改一个部署的注解并保存，刷新后仍在。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署的详情
2. 点击「编辑 YAML」
3. 读取编辑器内容
4. 不做修改直接保存

## 期望结果

- 编辑器预填对象 YAML，包含 metadata.name 与 namespace
- 保存按钮可用，点击后对话框关闭
- 对象仍以原名称存在，未被重命名或清空

## 失败排查

- 编辑器为空时先看详情对象是否已加载
- 保存失败时看 PUT 是否打到 /apis/apps/v1 且带 resourceVersion

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
- 编辑器结构变化时改 pages/app_workloads.py
