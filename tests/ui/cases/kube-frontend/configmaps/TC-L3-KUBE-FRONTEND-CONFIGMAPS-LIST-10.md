# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10 每页条数选择器收尾（集群告警消息、快照类、资源监控排行）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-messages`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

集群告警消息、集群快照类、集群资源监控排行也提供每页条数选择器；切换后服务端分页列表发出新 limit，客户端排行列表只渲染当前页；列表本身不足一页时不渲染分页器（与旧 console 一致）。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10** — 已知集群告警消息、集群快照类与集群资源监控排行也提供每页条数选择器（10/20/50/100）：服务端分页的两页切换后发出 `limit=<新值>&page=1` 的请求，客户端排行的资源监控页切换后只渲染当前页；**列表本身不足一页时不渲染分页器**（因此也没有选择器），与旧 console 一致；工作空间配额与工作空间角色两页同理（数据超过一页时出现分页器与选择器）。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，按创建时间看最近的配置


**Independent Test**：进入列表，默认按创建时间倒序，第一条是最新创建的 ConfigMap；点击「名称」列头，顺序切换为按名称升序。

## 前置与配置

- 已登录；集群 host 可读

## 测试步骤

1. 打开集群告警消息，核对选择器默认 20，选 50 后出现 limit=50 请求
2. 打开集群快照类，核对选择器存在且可切换
3. 打开集群资源监控，核对选择器存在；切换后行数不超过 50

## 期望结果

- 三页都有 <前缀>:page-size 选择器
- 服务端分页（告警消息、快照类）切换后出现 limit=50 请求
- 客户端排行（资源监控）切换后行数 ≤ 50 且不超过服务端返回条数

## 失败排查

- 选择器不存在且列表不足一页：属正常（分页器不渲染）
- 选择器存在但请求没变：页大小没进 queryKey

## 产品改版后如何更新自动化

- 句柄：cluster-alerting-messages:page-size / cluster-snapshot-classes:page-size / cluster-resource-monitor:page-size
