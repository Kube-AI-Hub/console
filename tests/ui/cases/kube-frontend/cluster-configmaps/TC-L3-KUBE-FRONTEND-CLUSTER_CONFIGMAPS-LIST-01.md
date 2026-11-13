# TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01 集群配置字典 · 列表默认视图

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-configmaps/list.md`

## 产品功能

默认按创建时间倒序，表头为 名称、项目、字段、创建时间，行来自不同项目。

### 关联需求

- `prd/kube-frontend/cluster-configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-configmaps/list.md`](../../../../prd/kube-frontend/cluster-configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01** — Given 集群内有来自多个项目的 ConfigMap，When 打开列表，Then 表头依次为 名称 / 项目 / 字段 / 创建时间；默认按创建时间倒序；每行「项目」列显示对象所属项目，名称列第二行显示描述或 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-configmaps/list.md`](../../../../design/kube-frontend/cluster-configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-configmaps/list.md`](../../../../prd/kube-frontend/cluster-configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为集群运维，一次看清集群里所有项目的配置


**Independent Test**：进入列表，默认按创建时间倒序，行来自不同项目；「项目」列显示每个对象所属项目；点击「名称」列头切换为按名称排序。

## 前置与配置

- 已登录，且为集群管理员
- 集群内至少两个项目各有 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/clusters/host/configmaps
2. 核对表头与首行内容
3. 检查多行是否来自不同项目

## 期望结果

- 表头依次为 名称、项目、字段、创建时间
- 默认按创建时间倒序
- 每行「项目」列非空，且出现至少两个不同的项目名

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面 data-ai-state

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
