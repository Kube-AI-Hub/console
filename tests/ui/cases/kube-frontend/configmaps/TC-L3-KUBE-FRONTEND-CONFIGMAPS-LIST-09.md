# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09 每页条数选择器覆盖监控告警、平台用户、项目设置、联邦与商店管理

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alerts`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

监控告警、平台用户、项目设置（成员/角色/网络策略）、联邦项目、商店管理、镜像构建器都提供每页条数选择器；服务端分页切换后请求带新 limit，客户端分页切换后只渲染当前页。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09** — 已知下列列表都提供每页条数选择器（10/20/50/100）并且切换后生效：项目告警消息与告警策略、平台用户、项目成员与角色、项目网络策略、联邦项目、应用商店管理（应用表）、镜像构建器；服务端分页的列表在切换后发出 `limit=<新值>` 且 `page=1` 的请求（页大小必须进查询键），客户端分页的列表（告警策略合并三来源、联邦项目、存储类）在切换后只渲染当前页的行；选择器句柄形如 `<列表前缀>:page-size`。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录；集群 host 可读

## 测试步骤

1. 依次打开项目告警消息、告警策略、平台用户、项目成员、项目网络策略、联邦项目、商店管理、镜像构建器
2. 每页找到 <前缀>:page-size 选择器并选 50
3. 服务端分页的页面核对出现 limit=50 请求；客户端分页的页面核对行数不超过 50

## 期望结果

- 八处都有选择器且显示默认 10
- 服务端分页：limit=50 且 page=1 的请求出现（alerts / users / members / image-builder / store-manage:apps）
- 客户端分页：行数 ≤ 50 且等于当前页切片（alertingrules / federated-projects）

## 失败排查

- 选择器变了但请求没变：页大小没进 queryKey 或请求参数仍是常量
- 客户端分页行数超过 50：切片仍用常量 PAGE_SIZE

## 产品改版后如何更新自动化

- 句柄：alerts:page-size / alertingrules:page-size / users:page-size / members:page-size / networkpolicies:page-size / federated-projects:page-size / store-manage:apps:page-size / image-builder:page-size
